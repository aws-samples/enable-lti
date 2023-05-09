import * as jose from 'jose';
import { JWTVerifyResult } from 'jose';
import { PlatformConfig, PlatformConfigRecord } from './platformConfig';
import {
  JWTHeaderParameters,
  JWTPayload,
  KeyLike,
} from 'jose/dist/types/types';

export class LTIJwtPayload {
  private readonly _payload?: Record<string, any> & JWTPayload = undefined;
  private readonly _header?: JWTHeaderParameters = undefined;
  private readonly _key?: KeyLike | Uint8Array = undefined;

  readonly platformConfigRecord: PlatformConfigRecord;

  /**
   * Authentication response validation:
   * Ref: https://www.imsglobal.org/spec/security/v1p0/#authentication-response-validation
   *
   *  1. The Tool MUST Validate the signature of the ID Token according to JSON Web Signature [RFC7515], Section 5.2 using the Public Key from the Platform.
   *  2. The Issuer Identifier for the Platform MUST exactly match the value of the iss (Issuer) Claim (therefore the Tool MUST previously have been made aware of this identifier).
   *  3. The Tool MUST validate that the aud (audience) Claim contains its client_id value registered as an audience with the Issuer identified by the iss (Issuer) Claim.
   *      The aud (audience) Claim MAY contain an array with more than one element. The Tool MUST reject the ID Token if it does not list the client_id as a valid audience, or if it contains additional audiences not trusted by the Tool.
   *      The request message will be rejected with a HTTP code of 401
   *  4. If the ID Token contains multiple audiences, the Tool SHOULD verify that an azp Claim is present
   *  5 If an azp (authorized party) Claim is present, the Tool SHOULD verify that its client_id is the Claim's value
   *  6 The ID Token MUST contain a nonce Claim. The Tool SHOULD verify that it has not yet received this nonce value (within a Tool-defined time window)
   *      in order to help prevent replay attacks. The Tool MAY define its own precise method for detecting replay attacks.
   *
   *
   */
  static async load(
    token: string,
    platform: PlatformConfig
  ): Promise<LTIJwtPayload> {
    let jwt;
    const unverified: Record<string, any> = jose.decodeJwt(token);
    let platformConfigRecord: PlatformConfigRecord | undefined = undefined;
    try {
      platformConfigRecord = await platform.load(
        LTIJwtPayload.getAud(unverified.aud)!,
        unverified.iss!,
        unverified['https://purl.imsglobal.org/spec/lti/claim/deployment_id']
      );
    } catch (e) {
      throw e as Error;
    }
    try {
      // #1, #2, #3
      jwt = await this.verifyToken(token, platform, platformConfigRecord);
    } catch (e) {
      throw e as Error;
    }
    const jwtPayload = new LTIJwtPayload(jwt, platformConfigRecord);
    // #4
    if (jwtPayload.aud instanceof Array && jwtPayload.aud.length > 1 && jwtPayload.azp === undefined) {
      throw Error('Authorized Party not provided');
    }
    // #5
    if (
      jwtPayload.azp !== undefined &&
      jwtPayload.azp !== platformConfigRecord.clientId
    ) {
      throw Error('Invalid Authorized Party');
    }
    // #6
    if (jwtPayload.nonce === undefined) {
      throw Error('Nonce not provided');
    }
    return jwtPayload;
  }

  /**
   *  1. The Tool MUST Validate the signature of the ID Token according to JSON Web Signature [RFC7515], Section 5.2 using the Public Key from the Platform.
   *  2. The Issuer Identifier for the Platform MUST exactly match the value of the iss (Issuer) Claim (therefore the Tool MUST previously have been made aware of this identifier).
   *  3. The Tool MUST validate that the aud (audience) Claim contains its client_id value registered as an audience with the Issuer identified by the iss (Issuer) Claim.
   *      The aud (audience) Claim MAY contain an array with more than one element. The Tool MUST reject the ID Token if it does not list the client_id as a valid audience, or if it contains additional audiences not trusted by the Tool.
   *      The request message will be rejected with a HTTP code of 401
   */
  static async verifyToken(
    token: string,
    platform: PlatformConfig,
    platformConfigRecord?: PlatformConfigRecord
  ) {
    const unverifiedHeader = jose.decodeProtectedHeader(token);
    const unverified: Record<string, any> = jose.decodeJwt(token);
    if (!platformConfigRecord) {
      try {
        platformConfigRecord = await platform.load(
          LTIJwtPayload.getAud(unverified.aud)!,
          unverified.iss!
        );
      } catch (e) {
        throw e as Error;
      }
    }
    const issuer: string = platformConfigRecord.iss;
    const clientId: string = platformConfigRecord.clientId;
    const alg: string = unverifiedHeader.alg!;
    const jwks = jose.createRemoteJWKSet(
      new URL(platformConfigRecord.keySetUrl)
    );
    // #1, #2, #3
    const jwt = await jose.jwtVerify(token, jwks, {
      issuer: issuer,
      audience: clientId,
      algorithms: [alg],
    });
    return jwt;
  }

  private constructor(
    jwt: JWTVerifyResult & jose.ResolvedKey,
    platformConfigRecord: PlatformConfigRecord
  ) {
    this._payload = jwt.payload;
    this._header = jwt.protectedHeader;
    this._key = jwt.key;
    this.platformConfigRecord = platformConfigRecord;
  }

  public getClaim(...keys: string[]): string | undefined {
    let claim: string | undefined = undefined;
    if (this._payload !== undefined) {
      let currentRecord: any = new Map(Object.entries(this._payload));
      for (const key of keys) {
        if (currentRecord.has(key)) {
          const record = currentRecord.get(key);
          currentRecord =  typeof record === 'object' ? new Map(Object.entries(record)) : record;
          claim = record;
        } else {
          claim = undefined;
          break;
        }
      }
    }
    return claim;
  }

  get contextId(): string | undefined {
    return this.getClaim(
      'https://purl.imsglobal.org/spec/lti/claim/context',
      'id'
    );
  }

  get contextTitle(): string | undefined {
    return this.getClaim(
      'https://purl.imsglobal.org/spec/lti/claim/context',
      'title'
    );
  }

  get deepLinkingSettingsData(): string | undefined {
    return this.getClaim(
      'https://purl.imsglobal.org/spec/lti-dl/claim/deep_linking_settings',
      'data'
    );
  }

  get deepLinkingSettingsReturnUrl(): string | undefined {
    return this.getClaim(
      'https://purl.imsglobal.org/spec/lti-dl/claim/deep_linking_settings',
      'deep_link_return_url'
    );
  }

  get deploymentId(): string | undefined {
    return this.getClaim(
      'https://purl.imsglobal.org/spec/lti/claim/deployment_id'
    );
  }

  get endpointLineItem(): string | undefined {
    return this.getClaim(
      'https://purl.imsglobal.org/spec/lti-ags/claim/endpoint',
      'lineitem'
    );
  }

  get endpointLineItems(): string | undefined {
    return this.getClaim(
      'https://purl.imsglobal.org/spec/lti-ags/claim/endpoint',
      'lineitems'
    );
  }

  get scopes(): string | undefined {
    return this.getClaim(
      'https://purl.imsglobal.org/spec/lti-ags/claim/endpoint',
      'scopes'
    );
  }

  get iss(): string | undefined {
    return this._payload?.iss;
  }

  get messageType(): string | undefined {
    return this.getClaim(
      'https://purl.imsglobal.org/spec/lti/claim/message_type'
    );
  }

  get nonce(): string | undefined {
    return this.getClaim('nonce');
  }

  get platformProductCode(): string | undefined {
    return this.getClaim(
      'https://purl.imsglobal.org/spec/lti/claim/tool_platform',
      'product_family_code'
    );
  }

  get platformUrl(): string | undefined {
    return this.getClaim(
      'https://purl.imsglobal.org/spec/lti/claim/tool_platform',
      'url'
    );
  }

  get resourceLinkId(): string | undefined {
    return this.getClaim(
      'https://purl.imsglobal.org/spec/lti/claim/resource_link',
      'id'
    );
  }
  get resourceLinkTitle(): string | undefined {
    return this.getClaim(
      'https://purl.imsglobal.org/spec/lti/claim/resource_link',
      'title'
    );
  }
  get targetLinkUri(): string | undefined {
    return this.getClaim(
      'https://purl.imsglobal.org/spec/lti/claim/target_link_uri'
    );
  }
  get sub(): string | undefined {
    return this.getClaim('sub');
  }

  get payload(): Record<string, any> | undefined {
    return this.payload;
  }

  get aud(): string | string[] | undefined {
    return this._payload?.aud;
  }

  get azp(): string | undefined {
    return this.getClaim('azp');
  }

  public static getAud(aud: string | string[] | undefined): string | undefined {
    if (aud !== undefined) {
      if (aud instanceof Array) {
        return aud[0];
      } else {
        return aud;
      }
    } else {
      return undefined;
    }
  }
}
