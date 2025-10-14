import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async ({ deployments, getNamedAccounts, network }: HardhatRuntimeEnvironment) => {
  const { deploy, log } = deployments;
  const { deployer } = await getNamedAccounts();

  // If on Sepolia, put official v3 factory here; for localhost, deploy your own/mock and use that address.
  const UNIV3_FACTORY = process.env.UNIV3_FACTORY || "";

  if (!UNIV3_FACTORY) {
    log("UNIV3_FACTORY not set -> skipping pool helper deploy");
    return;
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
func.dependencies = ["TAB", "Market"];
