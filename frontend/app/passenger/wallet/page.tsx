import type { Metadata } from "next";
import { WalletView } from "@/components/ride/wallet-view";

export const metadata: Metadata = { title: "Wallet" };

export default function WalletPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Wallet</h1>
      <WalletView />
    </>
  );
}
