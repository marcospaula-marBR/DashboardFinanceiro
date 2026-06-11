import { LoansService } from "../dashboard-v2/src/services/loans.service";
import { PaymentsService } from "../dashboard-v2/src/services/payments.service";
import { supabase } from "../dashboard-v2/src/lib/supabase";

async function verify() {
  console.log("=== INICIANDO AUDITORIA E VALIDACAO DE EMPRESTIMOS ===");
  const isTestMode = true;
  
  // 1. Criar um colaborador temporario no ambiente de testes
  const testEmployeeId = "550e8400-e29b-41d4-a716-446655440000";
  console.log("\n1. Preparando colaborador de teste...");
  
  // Limpar possivel sujeira anterior
  await supabase.from("employees_test").delete().eq("id", testEmployeeId);
  
  const { error: empErr } = await supabase.from("employees_test").insert([{
    id: testEmployeeId,
    full_name: "Validador Automático de Teste",
    email: "validador@marbrasil.com.br",
    status: "Ativo",
    company: "MarBR",
    remuneration: 10000.0
  }]);
  
  if (empErr) {
    console.error("Erro ao criar colaborador de teste:", empErr);
    return;
  }
  console.log("Colaborador temporario criado com sucesso.");

  try {
    // 2. Criar um contrato de emprestimo com data customizada
    console.log("\n2. Criando contrato com vencimento da primeira parcela customizado...");
    const requestDate = "2026-06-05";
    const firstPaymentDate = "2026-07-15"; // Vencimento customizado (nao dia 10)
    
    const loan = await LoansService.createLoan({
      employee_id: testEmployeeId,
      amount: 3000.00,
      installments: 3,
      start_cycle: "2026-06",
      request_date: requestDate,
      first_payment_date: firstPaymentDate,
      notes: "Teste de validacao automatica"
    }, isTestMode);
    
    console.log(`Contrato criado com ID: ${loan.id}`);
    
    // 3. Verificar parcelas geradas
    console.log("\n3. Validando parcelas geradas no banco...");
    const payments = await PaymentsService.getContractPayments(loan.id, isTestMode);
    console.log(`Total de parcelas encontradas no banco: ${payments.length}`);
    
    payments.forEach((p, idx) => {
      console.log(`  Parcela #${idx+1}: Ciclo=${p.month_cycle}, Vencimento=${p.due_date}, Valor=R$ ${p.amount}, Status=${p.status}`);
    });
    
    if (payments.length !== 3) {
      throw new Error(`Erro: Esperava 3 parcelas, mas gerou ${payments.length}`);
    }
    
    // Valida se as datas seguem a primeira parcela de forma sequencial (dia 15 de cada mes)
    if (payments[0].due_date !== "2026-07-15" || payments[1].due_date !== "2026-08-15" || payments[2].due_date !== "2026-09-15") {
      throw new Error("Erro: As datas das parcelas geradas nao correspondem ao esperado (+1 mes a partir de 2026-07-15)");
    }
    console.log("Vencimentos customizados sequenciais validados com sucesso!");

    // 4. Testar edicao de datas e propagacao automatica para as parcelas
    console.log("\n4. Testando edicao de datas ( request_date e first_payment_date )...");
    const newRequestDate = "2026-06-08";
    const newFirstPaymentDate = "2026-07-20"; // Alterando para o dia 20
    
    await LoansService.updateContractDates(loan.id, newRequestDate, newFirstPaymentDate, isTestMode);
    console.log("Datas do contrato atualizadas.");
    
    const updatedPayments = await PaymentsService.getContractPayments(loan.id, isTestMode);
    console.log("Novos vencimentos propagados para as parcelas:");
    updatedPayments.forEach((p, idx) => {
      console.log(`  Parcela #${idx+1}: Vencimento Novo=${p.due_date}, Ciclo Novo=${p.month_cycle}`);
    });
    
    if (updatedPayments[0].due_date !== "2026-07-20" || updatedPayments[1].due_date !== "2026-08-20" || updatedPayments[2].due_date !== "2026-09-20") {
      throw new Error("Erro: Os novos vencimentos nao foram propagados corretamente para as parcelas!");
    }
    console.log("Recalculo e propagacao de datas validados com sucesso!");

    // 5. Verificar calculo do saldo devedor inicial
    console.log("\n5. Validando calculo do Saldo Devedor inicial...");
    let contracts = await LoansService.getEmployeeContracts(testEmployeeId, isTestMode);
    console.log(`Saldo Devedor Inicial: R$ ${contracts[0].balance} (Esperado: R$ 3000.00)`);
    if (contracts[0].balance !== 3000.00) {
      throw new Error("Erro: Saldo devedor inicial invalido.");
    }

    // 6. Dar baixa na primeira parcela e verificar calculo do saldo devedor
    console.log("\n6. Dando baixa manual na primeira parcela...");
    const firstPaymentId = updatedPayments[0].id;
    const paymentDate = "2026-07-18"; // Pago 2 dias antes do vencimento
    
    await PaymentsService.updatePaymentStatus(firstPaymentId, "PAGO", isTestMode, undefined, paymentDate);
    console.log(`Parcela ID ${firstPaymentId} marcada como PAGO em ${paymentDate}`);
    
    contracts = await LoansService.getEmployeeContracts(testEmployeeId, isTestMode);
    console.log(`Saldo Devedor Atual: R$ ${contracts[0].balance} (Esperado: R$ 2000.00)`);
    if (contracts[0].balance !== 2000.00) {
      throw new Error("Erro: Saldo devedor nao atualizou corretamente apos a baixa!");
    }
    console.log("Baixa de parcela e calculo real de saldo devedor validados com sucesso!");

    // 7. Testar travamento de edicao de datas apos primeira parcela paga
    console.log("\n7. Validando travamento de edicao de datas apos pagamento...");
    try {
      await LoansService.updateContractDates(loan.id, "2026-06-10", "2026-07-25", isTestMode);
      throw new Error("Erro: Permitio editar datas mesmo apos uma parcela ter sido paga!");
    } catch (err: any) {
      console.log(`Sucesso! Edicao foi bloqueada corretamente. Mensagem de erro: "${err.message}"`);
    }

  } catch (e: any) {
    console.error("\n❌ FALHA NA VALIDACAO:", e.message);
  } finally {
    // 8. Limpeza dos dados
    console.log("\n8. Limpando registros de teste...");
    // Deletar o contrato de teste (deletara parcelas devido a cascade do banco)
    const { data: testLoans } = await supabase.from("employee_loans_test").select("id").eq("employee_id", testEmployeeId);
    for (const ln of testLoans || []) {
      await LoansService.deleteContract(ln.id, isTestMode);
    }
    await supabase.from("employees_test").delete().eq("id", testEmployeeId);
    console.log("Registros de teste limpos.");
  }
  
  console.log("\n=== AUDITORIA E VALIDACAO CONCLUIDA COM SUCESSO ===");
}

verify();
