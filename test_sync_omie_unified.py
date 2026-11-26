import os
import unittest
from datetime import datetime
from unittest.mock import patch

import sync_omie_unified_v4 as mod


class TestSyncOmieUnified(unittest.TestCase):
    def test_resolve_omie_apps_named_and_filter(self):
        env_vars = {
            "OMIE_APP_KEY_MARBRASIL": "k_mb",
            "OMIE_APP_SECRET_MARBRASIL": "s_mb",
            "OMIE_APP_KEY_DZM": "k_dzm",
            "OMIE_APP_SECRET_DZM": "s_dzm",
            "OMIE_APP_KEY_G2": "k_g2",
            "OMIE_APP_SECRET_G2": "s_g2",
            "OMIE_APP_KEY_CONECTIUS": "k_con",
            "OMIE_APP_SECRET_CONECTIUS": "s_con",
        }
        with patch.dict(os.environ, env_vars, clear=True):
            all_apps = mod.resolve_omie_apps("all")
            self.assertEqual(len(all_apps), 4)
            by_name = {a["name"]: a for a in all_apps}
            self.assertEqual(by_name["Mar Brasil"]["empresa_id"], "8w7sxfya")
            self.assertEqual(by_name["DZM"]["empresa_id"], "8w7t3s0f")
            self.assertEqual(by_name["G2"]["empresa_id"], "g2")
            self.assertEqual(by_name["Conectius"]["empresa_id"], "conectius")
            for a in all_apps:
                self.assertNotIn("PLACEHOLDER", a["empresa_id"])

            filtered = mod.resolve_omie_apps("dzm")
            self.assertEqual(len(filtered), 1)
            self.assertEqual(filtered[0]["name"], "DZM")

    def test_resolve_omie_apps_numbered_fallback_and_dedup(self):
        env_vars = {
            "OMIE_APP_KEY_DZM": "named_key_dzm",
            "OMIE_APP_SECRET_DZM": "named_sec_dzm",
            "OMIE_APP_1_KEY": "num_key_mb",
            "OMIE_APP_1_SECRET": "num_sec_mb",
            "OMIE_APP_1_EMPRESA_ID": "8w7sxfya",
            "OMIE_APP_1_EMPRESA_NOME": "Mar Brasil",
            "OMIE_APP_2_KEY": "num_key_dzm",
            "OMIE_APP_2_SECRET": "num_sec_dzm",
            "OMIE_APP_2_EMPRESA_ID": "DZM_ID_PLACEHOLDER",
            "OMIE_APP_2_EMPRESA_NOME": "DZM",
        }
        with patch.dict(os.environ, env_vars, clear=True):
            apps = mod.resolve_omie_apps("all")
            self.assertEqual(len(apps), 2)
            by_name = {a["name"]: a for a in apps}
            # Named env takes precedence over numbered fallback
            self.assertEqual(by_name["DZM"]["key"], "named_key_dzm")
            self.assertEqual(by_name["DZM"]["empresa_id"], "8w7t3s0f")
            self.assertEqual(by_name["Mar Brasil"]["empresa_id"], "8w7sxfya")

    def test_dimension_payloads_and_empty_case(self):
        sync = mod.OmieSync("k", "s", "Mar Brasil", empresa_id="8w7sxfya")
        # Empty case
        self.assertEqual(sync.build_dim_categorias_payload(), [])
        self.assertEqual(sync.build_dim_projetos_payload(), [])
        self.assertEqual(sync.build_dim_fornecedores_payload(), [])

        def fake_call(url, call, param):
            if call == "ListarCategorias":
                return {
                    "categoria_cadastro": [
                        {"codigo": "2.01.01", "descricao": "Salários", "codigo_dre": "DRE-01"}
                    ],
                    "total_de_paginas": 1,
                }
            if call == "ListarProjetos":
                return {
                    "cadastro": [
                        {"codigo": 101, "nome": "Casa Tupi 771"},
                        {"codigo": 102, "nome": "Projeto Alpha"},
                    ],
                    "total_de_paginas": 1,
                }
            if call == "ListarClientes":
                return {
                    "clientes_cadastro": [
                        {
                            "codigo_cliente_omie": 9001,
                            "nome_fantasia": "Fornecedor Teste",
                            "razao_social": "Fornecedor Teste LTDA",
                            "cnpj_cpf": "12.345.678/0001-90",
                            "codigo_cliente_integracao": "F-9001",
                        }
                    ],
                    "total_de_paginas": 1,
                }
            return {}

        with patch.object(sync, "call_api", side_effect=fake_call):
            sync.sync_dimensions()

        cats = sync.build_dim_categorias_payload()
        projs = sync.build_dim_projetos_payload()
        forns = sync.build_dim_fornecedores_payload(now_iso="2026-11-26T12:00:00+00:00")

        self.assertEqual(len(cats), 1)
        self.assertEqual(cats[0]["empresa_id"], "8w7sxfya")
        self.assertEqual(cats[0]["codigo_conta_dre"], "DRE-01")

        self.assertEqual(len(projs), 2)
        self.assertEqual(projs[0]["descricao_projeto"], "Núcleo Jurídico")
        self.assertEqual(projs[0]["codigo_projeto"], 101)

        self.assertEqual(len(forns), 1)
        self.assertEqual(forns[0]["codigo_cliente_omie"], 9001)
        self.assertEqual(forns[0]["last_update"], "2026-11-26T12:00:00+00:00")

    def test_is_excluded_caixa(self):
        self.assertTrue(mod.is_excluded_caixa("0.01", "Saldo Inicial"))
        self.assertTrue(mod.is_excluded_caixa("0.02.01", "Transferência entre Contas"))
        self.assertTrue(mod.is_excluded_caixa("2.05", "Mútuo Sócios"))
        self.assertTrue(mod.is_excluded_caixa("2.05", "Recarga Cartão Corporativo"))
        self.assertFalse(mod.is_excluded_caixa("2.01.01", "Folha de Pagamento", "Competência 11/2026"))

    def test_process_cp_cr_multi_dept_zero_cancelled_and_mov_map(self):
        sync = mod.OmieSync("k", "s", "DZM", empresa_id="8w7t3s0f")
        sync.cat_map = {"2.01": {"descricao": "Serviços Terceiros", "codigo_conta_dre": "D1"}}
        sync.proj_map = {"55": "Projeto B"}
        sync.forn_map = {"77": {"nome_fantasia": "Empresa PJ", "razao_social": "Empresa PJ LTDA"}}

        mov_map = {
            "1001": {
                "data_pagamento": "2026-11-10",
                "valor_pago": 900.0,
                "nCodMovCC": "M-1001",
                "cOrigem": "BAXP",
            }
        }
        records = [
            # Multi-department paid title (proportional ratio 900 / 1000 = 0.9)
            {
                "codigo_lancamento_omie": 1001,
                "status_titulo": "LIQUIDADO",
                "codigo_categoria": "2.01",
                "codigo_cliente_fornecedor": 77,
                "codigo_projeto": 55,
                "valor_documento": 1000.0,
                "data_entrada": "05/11/2026",
                "data_emissao": "01/11/2026",
                "data_vencimento": "10/11/2026",
                "distribuicao": [
                    {"cDesDep": "Operacional", "nValDep": 600.0},
                    {"cDesDep": "Admin", "nValDep": 400.0},
                ],
            },
            # Open title with zero value (should keep data_pagamento=None)
            {
                "codigo_lancamento_omie": 1002,
                "status_titulo": "A VENCER",
                "codigo_categoria": "2.01",
                "valor_documento": 0.0,
                "data_vencimento": "20/11/2026",
            },
            # Cancelled title must be ignored
            {
                "codigo_lancamento_omie": 1003,
                "status_titulo": "CANCELADO",
                "codigo_categoria": "2.01",
                "valor_documento": 500.0,
            },
        ]

        rows = sync.process_cp_cr(records, "PAGAR", mov_map=mov_map)
        self.assertEqual(len(rows), 3)
        self.assertEqual(rows[0]["status"], "PAGO")
        self.assertEqual(rows[0]["data_pagamento"], "2026-11-10")
        self.assertEqual(rows[0]["data_registro"], "2026-11-05")
        self.assertAlmostEqual(rows[0]["valor_total"], -900.0)
        self.assertAlmostEqual(rows[0]["valor_alocado"], -540.0)
        self.assertAlmostEqual(rows[1]["valor_alocado"], -360.0)
        self.assertIsNone(rows[2]["data_pagamento"])
        self.assertEqual(rows[2]["valor_total"], 0.0)

    def test_process_movimentos_dedup_and_direction(self):
        sync = mod.OmieSync("k", "s", "Mar Brasil", empresa_id="8w7sxfya")
        sync.cat_map = {
            "1.01": {"descricao": "Receita Serviços"},
            "2.09": {"descricao": "Tarifas Bancárias"},
            "0.01": {"descricao": "Transferência"},
        }
        recs = [
            # Already in known_titles -> skip
            {"detalhes": {"nCodTitulo": "1001", "nCodMovCC": "5001", "cCodCateg": "2.09", "nValorMovCC": 50}},
            # Direct bank fee outflow
            {
                "detalhes": {
                    "nCodTitulo": "0",
                    "nCodMovCC": "5002",
                    "cNatureza": "P",
                    "cCodCateg": "2.09",
                    "nValorMovCC": 35.5,
                    "dDtPagamento": "15/11/2026",
                }
            },
            # Direct bank inflow
            {
                "detalhes": {
                    "nCodTitulo": "0",
                    "nCodMovCC": "5003",
                    "cNatureza": "R",
                    "cCodCateg": "1.01",
                    "nValorMovCC": 200.0,
                    "dDtCredito": "16/11/2026",
                }
            },
            # Transfer -> skip
            {"detalhes": {"nCodMovCC": "5004", "cCodCateg": "0.01", "cGrupo": "TRANSF", "nValorMovCC": 1000}},
        ]
        rows = sync.process_movimentos(recs, known_titles={"1001"})
        self.assertEqual(len(rows), 2)
        self.assertEqual(rows[0]["status"], "PAGO")
        self.assertAlmostEqual(rows[0]["valor_total"], -35.5)
        self.assertEqual(rows[1]["status"], "RECEBIDO")
        self.assertAlmostEqual(rows[1]["valor_total"], 200.0)

    def test_compute_start_date_cutoff_guard(self):
        fixed_now = datetime(2026, 11, 26)
        self.assertEqual(mod.compute_start_date("01/01/2024"), "01/06/2025")
        self.assertEqual(mod.compute_start_date("15/08/2026"), "15/08/2026")
        self.assertEqual(mod.compute_start_date(days_arg=30, today_dt=fixed_now), "27/10/2026")
        self.assertEqual(mod.compute_start_date(days_arg=2000, today_dt=fixed_now), "01/06/2025")

    def test_compact_raw_data_preserves_required_and_strips_bloat(self):
        self.assertEqual(mod.compact_raw_data(None), {})
        self.assertEqual(mod.compact_raw_data({}), {})

        sample_raw = {
            "codigo_lancamento_omie": 12345,
            "status_titulo": "PAGO",
            "id_conta_corrente": 999,
            "observacao": "Pagamento PJ",
            "valor_documento": 2500.0,
            "valor_ir": 0.0,
            "cnab_integracao_bancaria": {"huge": "blob", "banco": "001"},
            "boleto": {"cGerado": "N", "nNossoNum": "123"},
            "categorias": [{"cCodCateg": "2.01", "nVal": 2500}],
            "distribuicao": [{"cDesDep": "Operacional", "nValDep": 2500}],
            "info": {"uInc": "API", "dInc": "2026-11-01", "hInc": "10:00:00"},
            "detalhes": {
                "nCodTitulo": 12345,
                "cCodCateg": "2.01",
                "cCPFCNPJCliente": "12345678000199",
                "nCodCC": 999,
                "cExtraNaoUsado": "remover",
                "nValorIR": 0,
            },
        }
        compact = mod.compact_raw_data(sample_raw)
        self.assertEqual(compact["codigo_lancamento_omie"], 12345)
        self.assertEqual(compact["id_conta_corrente"], 999)
        self.assertNotIn("cnab_integracao_bancaria", compact)
        self.assertNotIn("boleto", compact)
        self.assertNotIn("categorias", compact)
        # Single-item distribuicao is omitted (valor_alocado already carries it)
        self.assertNotIn("distribuicao", compact)
        self.assertEqual(compact["info"], {"uInc": "API", "dInc": "2026-11-01"})
        self.assertEqual(compact["detalhes"]["cCPFCNPJCliente"], "12345678000199")
        self.assertNotIn("cExtraNaoUsado", compact["detalhes"])

        # Multi-department distribuicao is preserved compactly
        sample_multi = {
            "codigo_lancamento_omie": 99,
            "distribuicao": [
                {"cDesDep": "Adm", "nValDep": 100, "cCodDep": "1"},
                {"cDesDep": "Ops", "nValDep": 200, "cCodDep": "2"},
            ],
        }
        compact_multi = mod.compact_raw_data(sample_multi)
        self.assertEqual(
            compact_multi["distribuicao"],
            [{"cDesDep": "Adm", "nValDep": 100}, {"cDesDep": "Ops", "nValDep": 200}],
        )


if __name__ == "__main__":
    unittest.main()
