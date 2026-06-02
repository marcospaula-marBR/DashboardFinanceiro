import { Metadata } from "next";
import { APP_VERSION } from "@/version";

export const metadata: Metadata = {
  title: `Empréstimos Cockpit | Mar Brasil ${APP_VERSION}`,
  description: "Gestão Integrada de RH e Crédito consignado",
};

export default function EmprestimosLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
