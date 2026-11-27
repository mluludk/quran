import "./m0-proof.css";
import MushafProofClient, { type MushafPage } from "@/components/MushafProofClient";
import proofData from "@/data/m0-proof-pages.json";

export default function M0ProofPage() {
  return <MushafProofClient pages={proofData.pages as MushafPage[]} />;
}
