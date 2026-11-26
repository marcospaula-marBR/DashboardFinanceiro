import unittest
from unittest import mock

import sync_dre_studio as sds


class TestSyncDreStudio(unittest.TestCase):
    def test_per_company_category_isolation_and_dados_dre(self):
        cat_mar = sds.parse_category_record(
            "8w7sxfya",
            "Mar Brasil",
            {
                "codigo": "1.01.95",
                "descricao": "Retenções - PIS",
                "conta_receita": "N",
                "conta_despesa": "N",
                "transferencia": "N",
                "dadosDRE": {"codigoDRE": "1.01.02", "descricaoDRE": "Impostos", "sinalDRE": "-", "naoExibirDRE": "N"},
            },
        )
        cat_dzm = sds.parse_category_record(
            "8w7t3s0f",
            "DZM",
            {
                "codigo": "1.01.95",
                "descricao": "Créditos Mar Brasil",
                "conta_receita": "N",
                "conta_despesa": "N",
                "transferencia": "N",
                "dadosDRE": {"naoExibirDRE": "S"},
            },
        )
        cat_con = sds.parse_category_record(
            "conectius",
            "Conectius",
            {
                "codigo": "2.04.99",
                "descricao": "Equipamento eletrônico",
                "conta_despesa": "S",
                "transferencia": "N",
                "dadosDRE": {"codigoDRE": "2.11.01", "descricaoDRE": "Ativos", "sinalDRE": "-", "naoExibirDRE": "N"},
            },
        )
        self.assertEqual(cat_mar["descricao_categoria"], "Retenções - PIS")
        self.assertEqual(cat_mar["descricao_dre"], "Impostos")
        self.assertFalse(cat_mar["nao_exibir_dre"])

        self.assertEqual(cat_dzm["descricao_categoria"], "Créditos Mar Brasil")
        self.assertTrue(cat_dzm["nao_exibir_dre"])

        self.assertEqual(cat_con["descricao_categoria"], "Equipamento eletrônico")
        self.assertEqual(cat_con["descricao_dre"], "Ativos")
        self.assertFalse(cat_con["nao_exibir_dre"])

    def test_preserves_dividendos_mutuos_intermediacao_and_excludes_transfers(self):
        cat_div = {"codigo_categoria": "2.03.90", "descricao_categoria": "Distribuição de Dividendos", "transferencia": False}
        cat_mut = {"codigo_categoria": "1.04.99", "descricao_categoria": "Mútuo - Entradas", "transferencia": False}
        cat_trf = {"codigo_categoria": "0.01.02", "descricao_categoria": "Saída de Transferência", "transferencia": True}

        self.assertFalse(sds.is_transfer_record(cat_div, "2.03.90", "BAXP", "CONTA_A_PAGAR"))
        self.assertFalse(sds.is_transfer_record(cat_mut, "1.04.99", "CRCC", "CONTA_CORRENTE_REC"))
        self.assertTrue(sds.is_transfer_record(cat_trf, "0.01.02", "TRAP", "TRANSFERENCIA"))
        self.assertTrue(sds.is_transfer_record({}, "2.04.01", "TRAR", ""))

    def test_extrato_reconciler_exact_composite_and_one_to_one(self):
        reconciler = sds.ExtratoReconciler(
            [
                {
                    "nCodCC": 7662736722,
                    "nCodLancamento": 9001,
                    "nCodLancRelac": 9001,
                    "cSituacao": "Conciliado",
                    "dDataConciliacao": "15/09/2026",
                    "dDataLancamento": "10/09/2026",
                    "nCodCliente": 501,
                    "cCodCategoria": "2.03.13",
                    "nValorDocumento": -250.00,
                },
                {
                    "nCodCC": 7662736722,
                    "nCodLancamento": 9002,
                    "nCodLancRelac": 9002,
                    "cSituacao": "Conciliado",
                    "dDataConciliacao": "16/09/2026",
                    "dDataLancamento": "10/09/2026",
                    "nCodCliente": 502,
                    "cCodCategoria": "2.03.13",
                    "nValorDocumento": -100.00,
                },
                {
                    "nCodCC": 7662736722,
                    "nCodLancamento": 9003,
                    "nCodLancRelac": 9003,
                    "cSituacao": "Não conciliado",
                    "dDataConciliacao": None,
                    "dDataLancamento": "10/09/2026",
                    "nCodCliente": 502,
                    "cCodCategoria": "2.03.13",
                    "nValorDocumento": -100.00,
                },
            ]
        )

        # Match exato por ID
        self.assertEqual(
            reconciler.match("7662736722", "2026-09-10", "501", "2.03.13", 250.0, candidate_ids=["9001"]),
            (True, "2026-09-15", "Conciliado"),
        )
        # Dois lançamentos idênticos no mesmo dia consomem 1-para-1 na ordem do extrato
        self.assertEqual(
            reconciler.match("7662736722", "2026-09-10", "502", "2.03.13", 100.0),
            (True, "2026-09-16", "Conciliado"),
        )
        self.assertEqual(
            reconciler.match("7662736722", "2026-09-10", "502", "2.03.13", 100.0),
            (False, None, "Não conciliado"),
        )
        # Terceiro idêntico não possui linha livre no extrato
        self.assertEqual(
            reconciler.match("7662736722", "2026-09-10", "502", "2.03.13", 100.0),
            (False, None, "Sem extrato"),
        )

    def test_cp_cr_gross_net_taxes_cutover_and_collapsed_departments(self):
        cat_map = {
            "2.01.01": {
                "codigo_categoria": "2.01.01",
                "descricao_categoria": "Credenciado Operacional",
                "codigo_dre": "1.21.02",
                "descricao_dre": "Custo dos Serviços Prestados",
                "sinal_dre": "-",
                "nao_exibir_dre": False,
                "transferencia": False,
            }
        }
        movs = [
            {
                "detalhes": {
                    "nCodTitulo": 1001,
                    "nCodMovCC": 555001,
                    "nCodCC": 7662736722,
                    "cGrupo": "CONTA_A_PAGAR",
                    "cOrigem": "BAXP",
                    "dDtPagamento": "10/08/2026",
                    "dDtRegistro": "01/08/2026",
                },
                "resumo": {"nValPago": 900.0, "nValLiquido": 900.0},
            }
        ]
        mov_map = sds.build_mov_enrichment_map(movs)
        reconciler = sds.ExtratoReconciler(
            [
                {
                    "nCodCC": 7662736722,
                    "nCodLancamento": 555001,
                    "cSituacao": "Conciliado",
                    "dDataConciliacao": "11/08/2026",
                    "dDataLancamento": "10/08/2026",
                    "nCodCliente": 77,
                    "cCodCategoria": "2.01.01",
                    "nValorDocumento": -900.0,
                }
            ]
        )

        records = [
            # Título anterior ao corte de Conectius (Jul/26) deve ser ignorado
            {
                "codigo_lancamento_omie": 999,
                "status_titulo": "PAGO",
                "codigo_categoria": "2.01.01",
                "valor_documento": 500.0,
                "data_emissao": "01/05/2026",
                "data_entrada": "01/05/2026",
                "data_baixa": "15/05/2026",
                "data_vencimento": "15/05/2026",
            },
            # Título cancelado deve ser ignorado
            {
                "codigo_lancamento_omie": 1000,
                "status_titulo": "CANCELADO",
                "codigo_categoria": "2.01.01",
                "valor_documento": 500.0,
                "data_entrada": "01/08/2026",
            },
            # Título válido com retenção (1000 bruto -> 900 pago) e departamento duplicado no rateio
            {
                "codigo_lancamento_omie": 1001,
                "status_titulo": "PAGO",
                "codigo_categoria": "2.01.01",
                "codigo_cliente_fornecedor": 77,
                "codigo_projeto": 12,
                "id_conta_corrente": 7662736722,
                "valor_documento": 1000.0,
                "valor_ir": 100.0,
                "data_entrada": "01/08/2026",
                "data_emissao": "01/08/2026",
                "data_vencimento": "10/08/2026",
                "distribuicao": [
                    {"cDesDep": "Operação B2G", "nValDep": 400.0, "nPerDep": 40.0},
                    {"cDesDep": "Operação B2G", "nValDep": 600.0, "nPerDep": 60.0},
                ],
            },
        ]

        out = sds.process_cp_cr_records(
            "conectius",
            "Conectius",
            records,
            "PAGAR",
            cat_map,
            {"7662736722": "Bradesco"},
            {"12": "Projeto Teste"},
            {"77": {"nome": "Fornecedor Teste", "cnpj_cpf": "12345678000199"}},
            mov_map,
            reconciler,
            "2026-07-01",
        )
        self.assertEqual(len(out), 1)
        row = out[0]
        self.assertEqual(row["omie_id"], 1001)
        self.assertEqual(row["valor_documento"], 1000.0)
        self.assertEqual(row["valor_pago"], 900.0)
        self.assertEqual(row["valor_alocado"], 900.0)
        self.assertEqual(row["valor_alocado_bruto"], 1000.0)
        self.assertEqual(row["impostos_retidos"]["total"], 100.0)
        self.assertTrue(row["conciliado"])
        self.assertEqual(row["data_conciliacao"], "2026-08-11")
        self.assertEqual(row["situacao_extrato"], "Conciliado")
        self.assertEqual(row["conta_dre"], "Custo dos Serviços Prestados")

    def test_direct_cc_movements_dedup_and_g2_revenue(self):
        cat_map = {
            "1.01.02": {
                "codigo_categoria": "1.01.02",
                "descricao_categoria": "Clientes - Serviços Prestados",
                "codigo_dre": "1.01.01",
                "descricao_dre": "Receita Bruta de Vendas",
                "sinal_dre": "+",
                "nao_exibir_dre": False,
                "transferencia": False,
                "conta_receita": True,
            }
        }
        movs = [
            # Deve ser ignorado (espelho CONTA_A_PAGAR com nCodTitulo)
            {
                "detalhes": {
                    "nCodTitulo": 888,
                    "nCodMovCC": 7001,
                    "cGrupo": "CONTA_A_PAGAR",
                    "cNatureza": "P",
                    "cCodCateg": "2.01.01",
                    "nValorMovCC": 200.0,
                    "dDtRegistro": "10/07/2026",
                    "dDtPagamento": "10/07/2026",
                }
            },
            # Deve ser preservado (receita direta na conta corrente da G2)
            {
                "detalhes": {
                    "nCodTitulo": 0,
                    "nCodMovCC": 7002,
                    "nCodCC": 2510841995,
                    "cGrupo": "CONTA_CORRENTE_REC",
                    "cNatureza": "R",
                    "cCodCateg": "1.01.02",
                    "nValorMovCC": 34000.0,
                    "dDtRegistro": "10/08/2026",
                    "dDtPagamento": "10/08/2026",
                    "cNomeCliente": "PREFEITURA EXEMPLO",
                }
            },
        ]
        out = sds.process_direct_cc_movements(
            "g2",
            "G2",
            movs,
            known_titles={"888"},
            cat_map=cat_map,
            cc_map={"2510841995": "Bradesco - G2"},
            proj_map={},
            forn_map={},
            reconciler=None,
            cutover_iso="2026-05-01",
        )
        self.assertEqual(len(out), 1)
        row = out[0]
        self.assertEqual(row["tipo_registro"], "MOVIMENTO_CC")
        self.assertEqual(row["omie_id"], 7002)
        self.assertEqual(row["sinal"], 1)
        self.assertEqual(row["valor_pago"], 34000.0)
        self.assertEqual(row["conta_corrente_nome"], "Bradesco - G2")
        self.assertEqual(row["conta_dre"], "Receita Bruta de Vendas")

    def test_partial_settlements_title_summary_and_multiple_baixas(self):
        cat_map = {
            "1.01.02": {
                "codigo_categoria": "1.01.02",
                "descricao_categoria": "Clientes - Serviços B2G",
                "codigo_dre": "1.01.01",
                "descricao_dre": "Receita Bruta de Vendas",
                "sinal_dre": "+",
                "nao_exibir_dre": False,
                "transferencia": False,
            }
        }
        movs = [
            {
                "detalhes": {
                    "nCodTitulo": 12299705830,
                    "nCodCC": 7662736722,
                    "cGrupo": "CONTA_A_RECEBER",
                    "cOrigem": "VENR",
                    "dDtPagamento": "11/09/2026",
                    "dDtRegistro": "30/07/2026",
                    "nValorTitulo": 512218.74,
                },
                "resumo": {"cLiquidado": "S", "nValLiquido": 472265.68, "nValPago": 472265.68, "nValAberto": 0},
            },
            {
                "detalhes": {
                    "nCodTitulo": 12299705830,
                    "nCodCC": 7662736722,
                    "nCodMovCC": 12330660979,
                    "nCodBaixa": 12330660981,
                    "cGrupo": "CONTA_CORRENTE_REC",
                    "cOrigem": "BAXR",
                    "dDtPagamento": "11/09/2026",
                },
                "resumo": {"nValPago": 216156.31},
            },
            {
                "detalhes": {
                    "nCodTitulo": 12299705830,
                    "nCodCC": 7662736722,
                    "nCodMovCC": 12330661009,
                    "nCodBaixa": 12330661011,
                    "cGrupo": "CONTA_CORRENTE_REC",
                    "cOrigem": "BAXR",
                    "dDtPagamento": "11/09/2026",
                },
                "resumo": {"nValPago": 256109.37},
            },
        ]
        mov_map = sds.build_mov_enrichment_map(movs)
        reconciler = sds.ExtratoReconciler(
            [
                {
                    "nCodCC": 7662736722,
                    "nCodLancamento": 12330660979,
                    "cSituacao": "Conciliado",
                    "dDataConciliacao": "12/09/2026",
                    "dDataLancamento": "11/09/2026",
                    "nCodCliente": 10,
                    "cCodCategoria": "1.01.02",
                    "nValorDocumento": 216156.31,
                },
                {
                    "nCodCC": 7662736722,
                    "nCodLancamento": 12330661009,
                    "cSituacao": "Conciliado",
                    "dDataConciliacao": "13/09/2026",
                    "dDataLancamento": "11/09/2026",
                    "nCodCliente": 10,
                    "cCodCategoria": "1.01.02",
                    "nValorDocumento": 256109.37,
                },
            ]
        )
        records = [
            {
                "codigo_lancamento_omie": 12299705830,
                "status_titulo": "RECEBIDO",
                "codigo_categoria": "1.01.02",
                "codigo_cliente_fornecedor": 10,
                "id_conta_corrente": 7662736722,
                "valor_documento": 512218.74,
                "valor_iss": 15366.56,
                "valor_ir": 24586.50,
                "data_registro": "30/07/2026",
                "data_vencimento": "30/08/2026",
            }
        ]
        out = sds.process_cp_cr_records(
            "8w7sxfya",
            "Mar Brasil",
            records,
            "RECEBER",
            cat_map,
            {"7662736722": "Bradesco"},
            {},
            {"10": {"nome": "PREF SANTOS"}},
            mov_map,
            reconciler,
            "2025-06-01",
        )
        self.assertEqual(len(out), 1)
        row = out[0]
        self.assertEqual(row["valor_pago"], 472265.68)
        self.assertEqual(row["valor_alocado"], 472265.68)
        self.assertEqual(row["valor_alocado_bruto"], 512218.74)
        self.assertEqual(row["raw_meta"]["baixas_qtd"], 2)
        self.assertTrue(row["conciliado"])
        self.assertEqual(row["data_conciliacao"], "2026-09-13")
        self.assertEqual(row["situacao_extrato"], "Conciliado")

    def test_partial_settlements_baixas_only_without_title_summary(self):
        movs = [
            {
                "detalhes": {
                    "nCodTitulo": 12250967145,
                    "nCodCC": 7662736722,
                    "nCodMovCC": 101,
                    "nCodBaixa": 201,
                    "cGrupo": "CONTA_CORRENTE_PAG",
                    "cOrigem": "BAXP",
                    "dDtPagamento": "28/05/2026",
                },
                "resumo": {"nValPago": 10560.00},
            },
            {
                "detalhes": {
                    "nCodTitulo": 12250967145,
                    "nCodCC": 7662736722,
                    "nCodMovCC": 102,
                    "nCodBaixa": 202,
                    "cGrupo": "CONTA_CORRENTE_PAG",
                    "cOrigem": "BAXP",
                    "dDtPagamento": "29/05/2026",
                },
                "resumo": {"nValPago": 4990.00},
            },
            # Duplicata com mesmo nCodBaixa nao deve somar duas vezes
            {
                "detalhes": {
                    "nCodTitulo": 12250967145,
                    "nCodCC": 7662736722,
                    "nCodMovCC": 101,
                    "nCodBaixa": 201,
                    "cGrupo": "CONTA_CORRENTE_PAG",
                    "cOrigem": "BAXP",
                    "dDtPagamento": "28/05/2026",
                },
                "resumo": {"nValPago": 10560.00},
            },
        ]
        mov_map = sds.build_mov_enrichment_map(movs)
        self.assertEqual(mov_map["12250967145"]["valor_pago"], 15550.00)
        self.assertEqual(mov_map["12250967145"]["data_pagamento"], "2026-05-29")
        self.assertEqual(len(mov_map["12250967145"]["baixas"]), 2)

    def test_partial_unsettled_status_uses_val_pago_not_val_liquido(self):
        cat_map = {
            "2.01.01": {
                "codigo_categoria": "2.01.01",
                "descricao_categoria": "Credenciado Operacional",
                "codigo_dre": "1.21.02",
                "descricao_dre": "Custo dos Serviços Prestados",
                "sinal_dre": "-",
                "nao_exibir_dre": False,
                "transferencia": False,
            }
        }
        movs = [
            {
                "detalhes": {
                    "nCodTitulo": 3001,
                    "cGrupo": "CONTA_A_PAGAR",
                    "cOrigem": "MANP",
                    "dDtPagamento": "10/08/2026",
                    "nValorTitulo": 1000.0,
                },
                "resumo": {"cLiquidado": "N", "nValAberto": 500.0, "nValPago": 500.0, "nValLiquido": 1000.0},
            }
        ]
        mov_map = sds.build_mov_enrichment_map(movs)
        records = [
            {
                "codigo_lancamento_omie": 3001,
                "status_titulo": "PAGO PARCIAL",
                "codigo_categoria": "2.01.01",
                "valor_documento": 1000.0,
                "data_entrada": "01/08/2026",
                "data_vencimento": "10/08/2026",
            }
        ]
        out = sds.process_cp_cr_records(
            "8w7sxfya", "Mar Brasil", records, "PAGAR", cat_map, {}, {}, {}, mov_map, None, "2025-06-01"
        )
        self.assertEqual(len(out), 1)
        self.assertEqual(out[0]["valor_pago"], 500.0)
        self.assertEqual(out[0]["valor_alocado"], 500.0)
        self.assertEqual(out[0]["status"], "PAGO PARCIAL")

    def test_cmc_category_is_ignored_in_categories_and_transactions(self):
        self.assertTrue(sds.is_cmc_category("Custo Médio (CMC) das Vendas"))
        self.assertTrue(sds.is_cmc_category("CMC"))
        self.assertFalse(sds.is_cmc_category("Credenciado Operacional"))

        parsed = sds.parse_category_record(
            "8w7sxfya",
            "Mar Brasil",
            {
                "codigo": "2.01.99",
                "descricao": "Custo Médio (CMC) das Vendas",
                "dadosDRE": {"codigoDRE": "1.21.01", "descricaoDRE": "CMV", "naoExibirDRE": "N"},
            },
        )
        self.assertTrue(parsed["nao_exibir_dre"])

        cat_map = {"2.01.99": parsed}
        out_cp = sds.process_cp_cr_records(
            "8w7sxfya",
            "Mar Brasil",
            [
                {
                    "codigo_lancamento_omie": 91001,
                    "status_titulo": "PAGO",
                    "codigo_categoria": "2.01.99",
                    "valor_documento": 55000.0,
                    "data_entrada": "15/09/2026",
                }
            ],
            "PAGAR",
            cat_map,
            {},
            {},
            {},
            {},
            None,
            "2025-06-01",
        )
        out_cc = sds.process_direct_cc_movements(
            "8w7sxfya",
            "Mar Brasil",
            [
                {
                    "detalhes": {
                        "nCodTitulo": 0,
                        "nCodMovCC": 92001,
                        "cGrupo": "CONTA_CORRENTE_PAG",
                        "cNatureza": "P",
                        "cCodCateg": "2.01.99",
                        "nValorMovCC": 1500.0,
                        "dDtRegistro": "15/09/2026",
                        "dDtPagamento": "15/09/2026",
                    }
                }
            ],
            known_titles=set(),
            cat_map=cat_map,
            cc_map={},
            proj_map={},
            forn_map={},
            reconciler=None,
            cutover_iso="2025-06-01",
        )
        self.assertEqual(out_cp, [])
        self.assertEqual(out_cc, [])

    def test_preserve_extrato_omits_reconciliation_columns(self):
        cat_map = {
            "2.01.01": {
                "codigo_categoria": "2.01.01",
                "descricao_categoria": "Credenciado Operacional",
                "codigo_dre": "1.21.02",
                "descricao_dre": "Custo dos Serviços Prestados",
                "sinal_dre": "-",
                "nao_exibir_dre": False,
                "transferencia": False,
            }
        }
        out_cp = sds.process_cp_cr_records(
            "8w7sxfya",
            "Mar Brasil",
            [
                {
                    "codigo_lancamento_omie": 5001,
                    "status_titulo": "PAGO",
                    "codigo_categoria": "2.01.01",
                    "valor_documento": 100.0,
                    "data_entrada": "10/08/2026",
                }
            ],
            "PAGAR",
            cat_map,
            {},
            {},
            {},
            {},
            None,
            "2025-06-01",
            preserve_extrato=True,
        )
        out_cc = sds.process_direct_cc_movements(
            "8w7sxfya",
            "Mar Brasil",
            [
                {
                    "detalhes": {
                        "nCodTitulo": 0,
                        "nCodMovCC": 5002,
                        "cGrupo": "CONTA_CORRENTE_PAG",
                        "cNatureza": "P",
                        "cCodCateg": "2.01.01",
                        "nValorMovCC": 200.0,
                        "dDtRegistro": "10/08/2026",
                        "dDtPagamento": "10/08/2026",
                    }
                }
            ],
            known_titles=set(),
            cat_map=cat_map,
            cc_map={},
            proj_map={},
            forn_map={},
            reconciler=None,
            cutover_iso="2025-06-01",
            preserve_extrato=True,
        )
        for row in (out_cp[0], out_cc[0]):
            self.assertNotIn("conciliado", row)
            self.assertNotIn("data_conciliacao", row)
            self.assertNotIn("situacao_extrato", row)

    def test_call_api_retries_client_8020_and_stops_on_5113(self):
        cli = sds.OmieStudioClient("k", "s", "Mar Brasil", "8w7sxfya", "2025-06-01")

        resp_8020 = mock.Mock(
            status_code=500,
            text='{"faultstring":"ERROR: Já existe uma requisição desse método sendo executada.","faultcode":"SOAP-ENV:Client-8020"}',
        )
        resp_ok = mock.Mock(status_code=200, text='{"ok": true}')
        resp_ok.json.return_value = {"ok": True}

        with mock.patch("sync_dre_studio.requests.post", side_effect=[resp_8020, resp_ok]) as post_mock, mock.patch(
            "sync_dre_studio.time.sleep"
        ) as sleep_mock:
            out = cli.call_api(sds.URL_MOV, "ListarMovimentos", {"nPagina": 1})
        self.assertEqual(out, {"ok": True})
        self.assertEqual(post_mock.call_count, 2)
        self.assertEqual(sleep_mock.call_count, 1)

        resp_5113 = mock.Mock(
            status_code=500,
            text='{"faultstring":"Não existem registros para a página solicitada","faultcode":"SOAP-ENV:Client-5113"}',
        )
        with mock.patch("sync_dre_studio.requests.post", side_effect=[resp_5113]) as post_mock2, mock.patch(
            "sync_dre_studio.time.sleep"
        ) as sleep_mock2:
            out2 = cli.call_api(sds.URL_MOV, "ListarMovimentos", {"nPagina": 999})
        self.assertEqual(out2, {})
        self.assertEqual(post_mock2.call_count, 1)
        self.assertEqual(sleep_mock2.call_count, 0)


if __name__ == "__main__":
    unittest.main()
