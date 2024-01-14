# Usage
Run `npm run build` to compile contracts and install dependencies and `npx ts-node src/withdraw-erc20.ts` to run the demo scripts.

## Overview
A standard ERC20 is deployed on the L1 and a corresponding OptimismMintable ERC20 is deployed on the L2. We first mint 1000 token on the L2, approve the L2 bridge, then withdraw. We prove and finalize as with a normal withdrawal. Then we demonstrate deposits.