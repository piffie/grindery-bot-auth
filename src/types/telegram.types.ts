/**
 * Represents the response object from the 'sendTelegramMessage' function.
 */
export type TelegramMessageResponse = {
  /**
   * Indicates whether the message was sent successfully.
   */
  success: boolean;

  /**
   * Contains a descriptive message related to the status of the sent message.
   */
  message: string;
};
