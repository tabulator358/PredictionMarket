import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  // Deploy mock Uniswap V3 factory for local testing
  const mockFactory = await deploy("MockUniswapV3Factory", {
    from: deployer,
    args: [],
    log: true,
    autoMine: true,
  });

  console.log(`MockUniswapV3Factory deployed at: ${mockFactory.address}`);
  
  // Set the factory address in environment for pool helper
  process.env.UNIV3_FACTORY = mockFactory.address;
};

export default func;
func.tags = ["MockFactory"];
