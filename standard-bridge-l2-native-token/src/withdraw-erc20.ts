import { ethers, Wallet } from "ethers";
import { CrossChainMessenger, MessageStatus, StandardBridgeAdapter } from "@constellation-labs/bedrock-sdk";
import {predeploys} from "@eth-optimism/contracts";
import { execSync } from "node:child_process";

execSync("npx hardhat compile", {stdio: 'inherit'})
const CalderaMintableERC20 = require('../artifacts/contracts/CalderaMintableERC20.sol/CalderaMintableERC20.json')
const OptimismUselessToken = require('../artifacts/contracts/OptimismUselessToken.sol/OptimismUselessToken.json')
require('dotenv').config()

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

const main = async () => {
    // input
    const L1_URL = process.env.L1_RPC_URL
    const PRIVATE_KEY = process.env.PRIVATE_KEY
    const L2_URL = process.env.L2_RPC_URL

    if (!L1_URL || !PRIVATE_KEY || !L2_URL) {
      throw new Error('All variables must be provided: L1_URL, PRIVATE_KEY, L2_URL')
    }
    
    // setup
    const l1Provider = new ethers.providers.JsonRpcProvider(L1_URL);
    const l1Wallet = new ethers.Wallet(PRIVATE_KEY, l1Provider); 
    const l2Provider = new ethers.providers.JsonRpcProvider(L2_URL);
    const l2Wallet: Wallet = new ethers.Wallet(PRIVATE_KEY, l2Provider);
    
    const messenger = new CrossChainMessenger({
      contracts: {
        l1: {
        StateCommitmentChain: "0x0000000000000000000000000000000000000000",
        BondManager: "0x0000000000000000000000000000000000000000",
        CanonicalTransactionChain: "0x0000000000000000000000000000000000000000",
        AddressManager: "0x0AaeDFF2961D05021832cA093cf9409eDF5ECa8C",
        L1CrossDomainMessenger: "0x7Ad11bB9216BC9Dc4CBd488D7618CbFD433d1E75",
        L1StandardBridge: "0x4638aC6b5727a8b9586D3eba5B44Be4b74ED41Fc",
        OptimismPortal: "0x7FD7eEA37c53ABf356cc80e71144D62CD8aF27d3",
        L2OutputOracle: "0x8553D4d201ef97F2b76A28F5E543701b25e55B1b"
        }
      },
      l1SignerOrProvider: l1Wallet,
      l2SignerOrProvider: l2Wallet,
      l1ChainId: 5,
      l2ChainId: 3441005,
      bedrock: true,
  })
  // deploy demo l2 ERC20
  const OptimismUselessTokenFactory = new ethers.ContractFactory(OptimismUselessToken.abi, OptimismUselessToken.bytecode, l2Wallet)
  const CalderaMintableERC20Factory = new ethers.ContractFactory(CalderaMintableERC20.abi, CalderaMintableERC20.bytecode, l1Wallet)

  const l2ERC20 = await OptimismUselessTokenFactory.deploy('Test', 'TST')
  await l2ERC20.deployed()
  console.log('l2ERC20 deployed to:', l2ERC20.address)
  const faucetTx = await l2ERC20.faucet()
  await faucetTx.wait(1)
  console.log("L2 ERC20 pre-balance", ethers.utils.formatUnits(await l2ERC20.balanceOf(l2Wallet.address)))

  const l1ERC20 = await CalderaMintableERC20Factory.deploy('0x4638aC6b5727a8b9586D3eba5B44Be4b74ED41Fc', l2ERC20.address, 'Test', 'TST', 18)
  await l1ERC20.deployed()
  console.log('l1ERC20 deployed to:', l1ERC20.address)
  console.log("L1 ERC20 pre-balance", ethers.utils.formatUnits(await l1ERC20.balanceOf(l1Wallet.address)))
  const before = new Date();

  // execution
  const withdrawAmount = ethers.utils.parseEther('0.1')
  // approve withdrawal on L2
  console.log(predeploys.L2StandardBridge)
  const approveTx = await l2ERC20.approve(predeploys.L2StandardBridge, withdrawAmount)
  await approveTx.wait(1)
  
  const withdrawalTx = await messenger.withdrawERC20(
    l1ERC20.address,
    l2ERC20.address,
    withdrawAmount
  )
  console.log("withdrawalTx hash", withdrawalTx.hash)
  console.log('waiting to prove, might take up to 20 minutes')
  await messenger.waitForMessageStatus(
    withdrawalTx,
    MessageStatus.READY_TO_PROVE,
    {
      pollIntervalMs: 60_000,
      timeoutMs: 30 * 60_000,
    }
  )
  const proveTx = await messenger.proveMessage(withdrawalTx)
  console.log('proveTx hash:', proveTx.hash)
  await messenger.waitForMessageStatus(
    withdrawalTx,
    MessageStatus.READY_FOR_RELAY
  )
  await sleep(20_000)
  const finalizeTx = await messenger.finalizeMessage(withdrawalTx)
  console.log('finalizeTx hash:', finalizeTx.hash)
  await messenger.waitForMessageReceipt(withdrawalTx)

  // after
  const after = new Date();
  console.log('It takes ' + ((after.getTime() - before.getTime()) / 1000) + ' seconds to finish')
  console.log("L1 ERC20 post-balance", ethers.utils.formatUnits(await l1ERC20.balanceOf(l1Wallet.address)))

  // now do a deposit
  const depositTx = await messenger.depositERC20(
    '0xa1b629966e60ADe9AfDe7be06860C43bfFA0dc47', // l1ERC20.address,
    '0xC8b8CbCd001F23aAF61a6b416f54407DFf2d2b3C', // l2ERC20.address,
    
    '1'
  )
  console.log("depositTx hash", depositTx.hash)
  await messenger.waitForMessageStatus(
    depositTx,
    MessageStatus.RELAYED
  )
  const depositReceipt = await messenger.waitForMessageReceipt(depositTx)
  console.log('finished deposit')
  console.log("L2 ERC20 post-balance", ethers.utils.formatUnits(await l2ERC20.balanceOf(l2Wallet.address)))

}

main()
