import * as web3 from "@solana/web3.js";
import { MY_SWAP_PROGRAM_ID, amm } from "./configs";
function main() {
  const [swapAuthority, bump] = web3.PublicKey.findProgramAddressSync(
    [amm.publicKey.toBuffer()],
    MY_SWAP_PROGRAM_ID
  );
  console.log("🚀 swapAuthority:", swapAuthority.toString());
  console.log("🚀 bump:", bump);
}
main();
