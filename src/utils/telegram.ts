import { Api } from 'telegram';
import { StringSession } from 'telegram/sessions/index';
import TGClient from './telegramClient';
import { decrypt } from './crypt';
import { WithId } from 'mongodb';
import { TelegramMessageResponse } from '../types/telegram.types';
import { MongoUser } from '../types/mongo.types';

/**
 * Sends a message via Telegram to a recipient.
 * @param message The content of the message to be sent.
 * @param recipientId The Telegram ID of the message recipient.
 * @param senderUser The sender's user information containing userHandle and telegramSession.
 * @returns A Promise that resolves to an object indicating the success status and a descriptive message.
 *          - success: A boolean indicating if the message was sent successfully.
 *          - message: A string providing details about the status of the message sending process.
 */
export const sendTelegramMessage = async (
  message: string,
  recipientId: string,
  senderUser: WithId<MongoUser>,
): Promise<TelegramMessageResponse> => {
  try {
    // Validation checks for required parameters
    if (!message) throw new Error('Message is required');
    if (!recipientId) throw new Error('Recipient ID is required');
    if (!senderUser.userHandle) throw new Error('Sender username not found');
    if (!senderUser.telegramSession)
      throw new Error('Telegram session not found');

    // Establishing a Telegram client
    const client = TGClient(
      new StringSession(decrypt(senderUser.telegramSession)),
    );

    // Connect to Telegram
    await client.connect();

    // Check if the client is connected successfully
    if (!client.connected) {
      throw new Error('Telegram client not connected');
    }

    // Fetch recipient's handle
    const recipient: Api.users.UserFull = await client.invoke(
      new Api.users.GetFullUser({
        id: recipientId,
      }),
    );

    // Extract recipient's handle or set an empty string if not found
    const recipientHandle = (recipient.users?.[0] as Api.User)?.username || '';

    // Prepare data to send the message
    const data = {
      peer: recipientHandle,
      message: message,
    };

    // Send the message and await the result
    const result = await client.invoke(new Api.messages.SendMessage(data));

    // Check if the message was sent successfully and return appropriate response
    if (result) {
      return { success: true, message: 'Message sent successfully' };
    }
    return { success: false, message: 'Message sending failed' };
  } catch (error) {
    // Return error response in case of exceptions
    return { success: false, message: error.message };
  }
};
