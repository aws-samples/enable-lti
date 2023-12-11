import { v4 as uuidv4 } from 'uuid';
import { LTIMessageTypes, getSignedJWT } from './index';

export type ContentItem =
  | ContentItemLink
  | ContentItemLTIResourceLink
  | ContentItemFile
  | ContentItemHTML
  | ContentItemImage;

export enum ContentItemTypes {
  Link = 'link',
  LTIResourceLink = 'ltiResourceLink',
  File = 'file',
  HTML = 'html',
  Image = 'image',
}

//https://www.imsglobal.org/spec/lti-dl/v2p0#link
export type ContentItemLink = {
  type: ContentItemTypes.Link;
  url: string;
  title?: string;
  text?: string;
  icon?: {
    url: string;
    width: number;
    height: number;
  };
  thumbnail?: {
    url: string;
    width: number;
    height: number;
  };
  embed?: {
    html: string;
  };
  window?: {
    targetName: string;
    width: number;
    height: number;
    windowFeatures: string;
  };
  iframe?: {
    src: string;
    width: number;
    height: number;
  };
};

//https://www.imsglobal.org/spec/lti-dl/v2p0#lti-resource-link
export type ContentItemLTIResourceLink = {
  type: ContentItemTypes.LTIResourceLink;
  url?: string;
  title?: string;
  text?: string;
  icon?: {
    url: string;
    width: number;
    height: number;
  };
  thumbnail?: {
    url: string;
    width: number;
    height: number;
  };
  iframe?: {
    width: number;
    height: number;
  };
  custom?: object;
  lineItem?: {
    scoreMaximum: number;
    label?: string;
    resourceId?: string;
    tag?: string;
  };
  available?: {
    startDateTime?: string;
    endDateTime?: string;
  };
  submission?: {
    startDateTime?: string;
    endDateTime?: string;
  };
};

//https://www.imsglobal.org/spec/lti-dl/v2p0#file
export type ContentItemFile = {
  type: ContentItemTypes.File;
  url: string;
  title?: string;
  text?: string;
  icon?: {
    url: string;
    width: number;
    height: number;
  };
  thumbnail?: {
    url: string;
    width: number;
    height: number;
  };
  expiresAt?: string;
};

//https://www.imsglobal.org/spec/lti-dl/v2p0#html
export type ContentItemHTML = {
  type: ContentItemTypes.HTML;
  html: string;
  title?: string;
  text?: string;
};

//https://www.imsglobal.org/spec/lti-dl/v2p0#image
export type ContentItemImage = {
  type: ContentItemTypes.Image;
  url: string;
  title?: string;
  text?: string;
  icon?: {
    url: string;
    width: number;
    height: number;
  };
  thumbnail?: {
    url: string;
    width: number;
    height: number;
  };
  width?: number;
  height?: number;
};

//https://www.imsglobal.org/spec/lti-dl/v2p0#deep-linking-response-message
export const createDeepLinkingMessage = async (
  receivedToken: { aud: string; iss: string; deploymentId: string },
  contentItems: ContentItemLTIResourceLink[],
  options: { message: string; deepLinkingSettingsData: string },
  keyDetails: { keyId: string; kid: string }
) => {
  try {
    const iat = Math.floor(Date.now() / 1000);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const exp = Math.floor(tomorrow.getTime() / 1000);
    const jwtBody = {
      iat,
      exp,
      iss: receivedToken.iss,
      aud: [receivedToken.aud],
      nonce: uuidv4(),
      'https://purl.imsglobal.org/spec/lti/claim/deployment_id':
        receivedToken.deploymentId,
      'https://purl.imsglobal.org/spec/lti/claim/message_type':
        LTIMessageTypes.LTIDeepLinkingResponse,
      'https://purl.imsglobal.org/spec/lti/claim/version': '1.3.0',
      'https://purl.imsglobal.org/spec/lti-dl/claim/content_items':
        contentItems,
      'https://purl.imsglobal.org/spec/lti-dl/claim/msg': options.message,
      'https://purl.imsglobal.org/spec/lti-dl/claim/data':
        options.deepLinkingSettingsData,
    };
    return await getSignedJWT(jwtBody, keyDetails);
  } catch (e) {
    const error = e as Error;
    throw error;
  }
};
