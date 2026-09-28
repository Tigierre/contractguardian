/**
 * JWKS locale per i test dei privilegi admin: un server HTTP su 127.0.0.1 che
 * pubblica la chiave pubblica, e una funzione per firmare JWT con la privata.
 */
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { SignJWT, exportJWK, generateKeyPair, type JWTPayload } from 'jose';

export interface TestIssuer {
  jwksUrl: string;
  sign(claims: JWTPayload, opts?: { issuer?: string; audience?: string; expiresIn?: string | number }): Promise<string>;
  close(): Promise<void>;
}

export async function startTestIssuer(kid: string): Promise<TestIssuer> {
  const { publicKey, privateKey } = await generateKeyPair('RS256');
  const jwk = { ...(await exportJWK(publicKey)), kid, alg: 'RS256', use: 'sig' };
  const server = http.createServer((_req, res) => {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ keys: [jwk] }));
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;

  return {
    jwksUrl: `http://127.0.0.1:${port}/jwks/`,
    async sign(claims, opts = {}) {
      let jwt = new SignJWT(claims)
        .setProtectedHeader({ alg: 'RS256', kid })
        .setIssuedAt()
        .setExpirationTime(opts.expiresIn ?? '5m');
      if (opts.issuer) jwt = jwt.setIssuer(opts.issuer);
      if (opts.audience) jwt = jwt.setAudience(opts.audience);
      return jwt.sign(privateKey);
    },
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}
