const {join} = require('path');

const grpc = require('grpc');
const {loadSync} = require('@grpc/proto-loader');

const expectedSslConfiguration = require('./conf/lnd').grpc_ssl_cipher_suites;

const confDir = 'conf';
const defaultServiceType = 'Lightning';
const {GRPC_SSL_CIPHER_SUITES} = process.env;
const protoFile = 'grpc.proto';
const unlockerServiceType = 'WalletUnlocker';

/** GRPC interface to the Lightning Network Daemon (lnd).

  Make sure to provide a cert when using LND with its default self-signed cert

  {
    [cert]: <Base64 Serialized LND TLS Cert>
    macaroon: <Base64 Serialized Macaroon String>
    [service]: <Service Name String> // "WalletUnlocker"|"Lightning" (default)
    socket: <Host:Port String>
  }

  @throws
  <ExpectedBase64EncodedGrpcMacaroonFile Error>
  <ExpectedBase64EncodedTlsCertFileString Error>
  <ExpectedGrpcIpOrDomainWithPortString Error>
  <ExpectedGrpcSslCipherSuitesEnvVar Error>
  <UnexpectedLightningDaemonServiceType Error>

  @returns
  <LND GRPC Api Object>
*/
module.exports = ({cert, macaroon, service, socket}) => {
  if (!macaroon && service !== unlockerServiceType) {
    throw new Error('ExpectedBase64EncodedGrpcMacaroonFile');
  }

  if (!socket) {
    throw new Error('ExpectedGrpcIpOrDomainWithPortString');
  }

  const packageDefinition = loadSync(join(__dirname, confDir, protoFile), {
    defaults: true,
    enums: String,
    keepCase: true,
    longs: String,
    oneofs: true,
  });

  const rpc = grpc.loadPackageDefinition(packageDefinition);

  // Exit early when GRPC_SSL_CIPHER_SUITES cipher suite is not correct
  if (!!cert && GRPC_SSL_CIPHER_SUITES !== expectedSslConfiguration) {
    throw new Error('ExpectedGrpcSslCipherSuitesEnvVar');
  }
  
  let credentials;
  const serviceType = service || defaultServiceType;
  let ssl;

  const certData = !!cert ? Buffer.from(cert, 'base64') : null;

  if (!!certData) {
    ssl = grpc.credentials.createSsl(certData);
  } else {
    ssl = grpc.credentials.createSsl();
  }

  switch (serviceType) {
  case defaultServiceType:
    const macaroonData = /^([0-9A-Fa-f]{2})+$/g.test(macaroon) ? macaroon : Buffer.from(macaroon, 'base64').toString('hex');

    const macCreds = grpc.credentials.createFromMetadataGenerator((_, cbk) => {
      const metadata = new grpc.Metadata();

      metadata.add('macaroon', macaroonData);

      return cbk(null, metadata);
    });

    credentials = grpc.credentials.combineChannelCredentials(ssl, macCreds);
    break;

  case unlockerServiceType:
    credentials = ssl;
    break;

  default:
    throw new Error('UnexpectedLightningDaemonServiceType');
  }

  return new rpc.lnrpc[serviceType](socket, credentials);
};

