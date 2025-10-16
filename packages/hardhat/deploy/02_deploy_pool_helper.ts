import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async ({ deployments, getNamedAccounts, network }: HardhatRuntimeEnvironment) => {
  const { deploy, log, get } = deployments;
  const { deployer } = await getNamedAccounts();

  // For local testing, get the mock factory address from deployment
  let UNIV3_FACTORY = process.env.UNIV3_FACTORY;
  
  if (!UNIV3_FACTORY) {
    // Try to get from deployed mock factory
    try {
      const mockFactory = await get("MockUniswapV3Factory");
      UNIV3_FACTORY = mockFactory.address;
      log(`Using deployed MockUniswapV3Factory at: ${UNIV3_FACTORY}`);
    } catch (e) {
      log("No UNIV3_FACTORY set and no MockUniswapV3Factory deployed -> skipping pool helper deploy");
      return;
    }
  }

  const helper = await deploy("UniV3PoolHelper", {
    from: deployer,
    args: [UNIV3_FACTORY],
    log: true,
    waitConfirmations: 1,
  });

  log(`UniV3PoolHelper deployed at: ${helper.address}`);
};
export default func;
func.tags = ["Pool"];
func.dependencies = ["TAB", "Market", "MockFactory"];
