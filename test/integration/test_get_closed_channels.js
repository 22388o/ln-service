const {test} = require('tap');

const closeChannel = require('./../../closeChannel');
const {createCluster} = require('./../macros');
const {delay} = require('./../macros');
const getChannels = require('./../../getChannels');
const getClosedChannels = require('./../../getClosedChannels');
const openChannel = require('./../../openChannel');
const {waitForChannel} = require('./../macros');

const confirmationCount = 20;
const defaultFee = 1e3;
const maxChanTokens = Math.pow(2, 24) - 1;

// Getting closed channels should return closed channels
test(`Close channel`, async ({end, equal}) => {
  const cluster = await createCluster({});

  const channelOpen = await openChannel({
    chain_fee_tokens_per_vbyte: defaultFee,
    lnd: cluster.control.lnd,
    partner_public_key: cluster.target_node_public_key,
    socket: `${cluster.target.listen_ip}:${cluster.target.listen_port}`,
  });

  await delay(1000);

  await cluster.generate({count: confirmationCount});

  await waitForChannel({
    id: channelOpen.transaction_id,
    lnd: cluster.control.lnd,
  });

  const closing = await closeChannel({
    lnd: cluster.control.lnd,
    tokens_per_vbyte: defaultFee,
    transaction_id: channelOpen.transaction_id,
    transaction_vout: channelOpen.transaction_vout,
  });

  await delay(1000);

  await cluster.generate({count: confirmationCount});

  const {channels} = await getClosedChannels({lnd: cluster.control.lnd});

  const [channel] = channels;

  equal(channels.length, [channelOpen].length, 'Channel close listed');

  equal(channel.capacity, maxChanTokens - 1e3, 'Channel capacity reflected');
  equal(!!channel.close_confirm_height, true, 'Channel close height');
  equal(channel.close_transaction_id, closing.transaction_id, 'Close tx id');
  equal(maxChanTokens - channel.final_local_balance, 10050, 'Final balance');
  equal(channel.final_time_locked_balance, 0, 'Final locked balance');
  equal(!!channel.id, true, 'Channel id');
  equal(channel.is_breach_close, false, 'Not breach close');
  equal(channel.is_cooperative_close, true, 'Is cooperative close');
  equal(channel.is_funding_cancel, false, 'Not funding cancel');
  equal(channel.is_local_force_close, false, 'Not local force close');
  equal(channel.is_remote_force_close, false, 'Not remote force close');
  equal(channel.partner_public_key, cluster.target_node_public_key, 'Pubkey');
  equal(channel.transaction_id, channelOpen.transaction_id, 'Channel tx id');
  equal(channel.transaction_vout, channelOpen.transaction_vout, 'Chan vout');

  await cluster.kill({});

  return end();
});
