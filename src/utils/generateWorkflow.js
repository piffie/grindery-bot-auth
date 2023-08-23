export const generateWorkflow = ({
  address,
  webhook,
  responsepath,
  trigger,
  chains,
  creator,
}) => {
  const workflow = {
    title: `[Grindery AI] PatchWallet ${address.toLowerCase()} ${
      trigger === "evmWallet" ? "native token" : "erc-20 token"
    } transaction to webhook`,
    trigger: {
      type: "trigger",
      connector: trigger,
      operation: trigger === "evmWallet" ? "newTransaction" : "TransferTrigger",
      input: {
        _grinderyChain: chains,
        to: address,
      },
    },
    actions: [
      {
        type: "action",
        connector: "genericWebhook",
        operation: "inboundWebhookAction",
        input: {
          method: "POST",
          content_type: "application/json",
          url: webhook,
          data: {
            responsepath: responsepath,
            from: "{{trigger.from}}",
            to: "{{trigger.to}}",
            value: "{{trigger.value}}",
            _grinderyChain: "{{trigger._grinderyChain}}",
          },
        },
      },
    ],
    creator: creator,
    state: "on",
    source: "urn:grindery:bot-api",
  };
  if (trigger === "evmWallet") {
    workflow.trigger.input._grinderyContractAddress = "0x0";
    workflow.actions[0].input.data.__transactionHash =
      "{{trigger.__transactionHash}}";
    workflow.actions[0].input.data.hash = "{{trigger.hash}}";
    workflow.actions[0].input.data.blockHash = "{{trigger.blockHash}}";
    workflow.actions[0].input.data.blockNumber = "{{trigger.blockNumber}}";
    workflow.actions[0].input.data.txfees = "{{trigger.txfees}}";
  }
  if (trigger === "erc20") {
    workflow.trigger.input._grinderyContractAddress = "0x0";
    workflow.actions[0].input.data.txfees = "{{trigger.__transactionHash}}";
    workflow.actions[0].input.data._grinderyContractAddress =
      "{{trigger._grinderyContractAddress}}";
  }

  workflow.actions[0].input.data = JSON.stringify(
    workflow.actions[0].input.data
  );

  return workflow;
};
