import { Metadata } from "next";
import { APP_VERSION } from "@/version";

export const metadata: Metadata = {
  title: `People Cockpit | Mar Brasil ${APP_VERSION}`,
  description: "Gestão Integrada de RH e Crédito consignado",
};

export default function PeopleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
