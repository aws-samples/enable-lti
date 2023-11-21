import { escape } from 'html-escaper';

export const getErrorResponseTemplate = (
  errorString: string,
  nonce: string
): string => {
  return `
  <!DOCTYPE html>
  <html lang="en">
  
  <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Error Page</title>
      <style nonce="${nonce}">
          body {
              font-family: Arial, sans-serif;
              color: #dbdbdb;
              background-color: #000000;
              margin: 0;
              padding: 0;
              display: flex;
              justify-content: center;
              align-items: center;
              height: 100vh;
              flex-direction: column;
          }
  
          .error-container {
              text-align: center;
          }
  
          .error-message {
              font-size: 24px;
              color: #888;
              margin-bottom: 40px;
          }
  
          .logo-img {
              max-width: 200px;
              margin-bottom: 20px;
          }
      </style>
  </head>
  
  <body>
      <div class="error-container">
          <div class="error-message">Oops! Something went wrong, please try again later.</div>
          <p>Error: ${escape(errorString)}</p>
      </div>
  </body>
  
  </html>
    `;
};
