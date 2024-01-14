// SPDX-License-Identifier: MIT
pragma solidity 0.8.15;

import { OptimismMintableERC20 } from "@eth-optimism/contracts-bedrock/contracts/universal/OptimismMintableERC20.sol";

contract CalderaMintableERC20 is OptimismMintableERC20 {
  uint8 immutable DECIMALS;
  constructor(
    address _bridge,
    address _remoteToken,
    string memory _name,
    string memory _symbol,
    uint8 _decimals
  ) OptimismMintableERC20(_bridge, _remoteToken, _name, _symbol) {
    DECIMALS = _decimals;
  }
  function decimals() public view virtual override returns (uint8) {
    return DECIMALS;
  }
}
