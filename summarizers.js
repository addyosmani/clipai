/**
 * @fileoverview This file contains different summarizer implementations.
 */

// Import the pipeline function from transformers.js
import { pipeline } from '@huggingface/transformers';

/**
 * @import { Pipeline } from '@huggingface/transformers'
 */

// #region Constants
const SYSTEM_PROMPT = `
You are a summarizer that creates clear, concise, short summaries of articles.

You will be given content from a webpage content. Produce a one-paragraph summary.
The maximum length of the paragraph is 5 sentences and must be
written in the third person.

Produce output in plain text.
`;
// #endregion

// #region Types

/**
 * @typedef {Object} DownloadProgressEvent
 * @property {number} loaded - The number of bytes loaded.
 * @property {number} total - The total number of bytes to be loaded.
 * 
 * @typedef {Object} SummarizerOptions
 * @property {(DownloadProgressEvent) => void} [onProgress] - A callback function to handle progress updates.
 * @property {AbortSignal} [signal] - An optional AbortSignal to cancel the operation.
 * 
 * @typedef {Object} SummarizeOptions
 * @property {AbortSignal} [signal] - An optional AbortSignal to cancel the operation.
 * 
 * @typedef {Object} PromptApiSession
 * @property {(string, SummarizeOptions?) => Promise<string>} prompt - A function to send a prompt to the session.
 * @property {Promise<boolean>} ready - A promise that resolves when the session is ready.
 * 
 * @typedef {Object} ChromeSummarizer
 * @property {(string) => Promise<string>} summarize - A function to summarize the input string.
 */

// #endregion

// #region Helper Functions

/**
 * Validates the input for the summarizer.
 * @param {string} input - The input string to validate.
 * @returns {void}
 * @throws {TypeError} If the input is not a string.
 * @throws {Error} If the input is an empty string.
 */
function assertValidInput(input) {
  if (typeof input !== 'string') {
    throw new TypeError('Input must be a string. Received ' + typeof input);
  }
  if (input.length === 0) {
    throw new Error('Input cannot be an empty string.');
  }
}

// #endregion

// #region PromptApiSummarizer

/**
 * Class representing a summarizer using the Prompt API.
 */
export class PromptApiSummarizer {

  /**
   * @type {PromptApiSession}
   */
  #session;

  /**
   * Creates an instance of PromptApiSummarizer.
   * @param {PromptApiSession} session - The session to use for summarization.
   */
  constructor(session) {
    this.#session = session;
  }

  /**
   * Checks if the Prompt API is available.
   * @returns {Promise<boolean>} True if the summarizer is available, false otherwise.
   */
  static async isAvailable() {
    return Boolean(await chrome.aiOriginTrial?.languageModel?.availability() === "available");
  }

  /**
   * Creates a new instance of PromptApiSummarizer.
   * @param {SummarizerOptions} options - Options for creating the summarizer.
   * @returns {Promise<PromptApiSummarizer>} A promise that resolves to a new instance of PromptApiSummarizer.
   */
  static async create({ onProgress = () => { }, signal } = {}) {

    if (!await PromptApiSummarizer.isAvailable()) {
      throw new Error('Prompt API is not available.');
    }

    const session = await chrome.aiOriginTrial.languageModel.create({
      systemPrompt: SYSTEM_PROMPT,
      monitor(m) {
        m.addEventListener('downloadprogress', onProgress);
      },
      signal
    });
    await session.ready;
    return new PromptApiSummarizer(session);
  }

  /**
   * Summarizes the given input.
   * @param {string} input - The input string to summarize.
   * @param {SummarizeOptions} [options] - Options for summarization.
   * @returns {Promise<string>} A promise that resolves to the summary of the input.
   * @throws {Error} If the session is not initialized or if the input is invalid.
   */
  async summarize(input, { signal } = {}) {

    if (!this.#session) {
      throw new Error('Session is not initialized.');
    }

    assertValidInput(input);

    return this.#session.prompt(`Summarize these paragraphs into a single paragraph of no more than five sentences:\n\n${input}`, { signal });
  }
  
  /**
   * Destroys the session, releasing any resources.
   * @returns {void}
   */
  destroy() {
    if (this.#session) {
      this.#session.destroy();
    }
  }
}

// #endregion

// #region NativeSummarizer

/**
 * Class representing a native summarizer.
 */
export class NativeSummarizer {

  #summarizer;

  /**
   * Creates an instance of NativeSummarizer.
   */
  constructor(summarizer) {
    this.#summarizer = summarizer;
  }

  /**
   * Checks if the native summarizer is available.
   * @returns {Promise<boolean>} True if the native summarizer is available, false otherwise.
   */
  static async isAvailable() {
    return Boolean(await globalThis.Summarizer?.availability?.() === "available");
  }

  /**
   * Creates a new instance of NativeSummarizer.
   * @param {SummarizerOptions} options - Options for creating the summarizer.
   * @returns {Promise<NativeSummarizer>} A promise that resolves to a new instance of NativeSummarizer.
   * @throws {Error} If the native summarizer is not available.
   */
  static async create({ onProgress = () => { }, signal } = {}) {
    if (!await NativeSummarizer.isAvailable()) {
      throw new Error('Native summarizer is not available.');
    }

    const summarizer = await globalThis.Summarizer.create({
      format: 'plain-text',
      type: 'tl;dr',
      sharedContext: 'An article from a webpage.',
      length: 'medium',
      monitor(m) {
        m.addEventListener('downloadprogress', onProgress);
      },
      signal
    });

    return new NativeSummarizer(summarizer);
  }

  /**
   * Summarizes the given input using native methods.
   * @param {string} input - The input string to summarize.
   * @param {SummarizeOptions} [options] - Options for summarization.
   * @returns {Promise<string>} A promise that resolves to the summary of the input.
   * @throws {Error} If the input is invalid.
   */
  async summarize(input, { signal } = {}) {
    
    if (!this.#summarizer) {
      throw new Error('Native summarizer is not initialized.');
    }
    
    assertValidInput(input);
    
    signal?.throwIfAborted();

    return this.#summarizer.summarize(input);
  }
  
  /**
   * Destroys the session, releasing any resources.
   * @returns {void}
   */
  destroy() {
    if (this.#summarizer) {
      this.#summarizer.destroy();
    }
  }
  
}

// #endregion

// #region T5Summarizer

/**
 * Class representing a summarizer using the T5 model via Transformers.js.
 */
export class T5Summarizer {

  /**
   * @type {Pipeline}
   */
  #summarize;

  /**
   * Creates an instance of T5Summarizer.
   * @param {Pipeline} summarizationPipeline - The summarization pipeline function.
   */
  constructor(summarizationPipeline) {
    this.#summarize = summarizationPipeline;
  }

  /**
   * Checks if the T5Summarizer is available by checking if the pipeline function is defined.
   * @returns {boolean} True if the pipeline function is defined, false otherwise.
   */
  static get isAvailable() {
    return typeof pipeline === 'function';
  }

  /**
   * Creates a new instance of T5Summarizer.
   * @param {SummarizerOptions} options - Options for creating the summarizer.
   * @returns {Promise<T5Summarizer>} A promise that resolves to a new instance of T5Summarizer.
   * @throws {Error} If the pipeline function is not available.
   */
  static async create({ onProgress = () => { } } = {}) {
    if (!T5Summarizer.isAvailable) {
      throw new Error('Transformers.js pipeline is not available.');
    }

    const modelId = 'Xenova/t5-small';
    console.log(`Initializing T5 summarizer with model ID: ${modelId}`);
    // downloads the model
    const response = await chrome.runtime.sendMessage({ action: 't5:init', modelId });
console.log(`T5 model initialization response:`, response);
    if (response.error) {
      throw new Error(`Failed to initialize T5 model: ${response.error}`);
    }
    
    // // Create the summarization pipeline
    // const summarizationPipeline = await pipeline(
    //   'summarization',
    //   modelId,
    //   {
    //     // only the "progress" event has the loaded and total properties
    //     progress_callback(event) {
    //       if (event.status === 'progress') {
    //         onProgress(event);
    //       }
    //     },
    //   }
    // );

    return new T5Summarizer(null);

  }

  /**
   * Summarizes the given input using the T5 model.
   * @param {string} input - The input string to summarize.
   * @param {SummarizeOptions & {length?: 'short'|'medium'|'long'}} [options] - Options for summarization.
   * @returns {Promise<string>} A promise that resolves to the summary of the input.
   * @throws {Error} If the input is invalid or if the pipeline is not initialized.
   */
  async summarize(input, { signal, length = 'medium' } = {}) {
    
    assertValidInput(input);
    
    // Check if the operation was cancelled
    signal?.throwIfAborted();
    
    const response = await chrome.runtime.sendMessage({
      action: 't5:summarize',
      data: {
        input,
        length
      }
    });

    if (response.error) {
      throw new Error(`Failed to summarize with T5 model: ${response.error}`);
    }
    
    return response.summary;
  }
}

// #endregion

/**
 * Array of available summarizers ordered by preference.
 * The first available summarizer will be used.
 */
const summarizers = [
  T5Summarizer,
  // PromptApiSummarizer,
  // NativeSummarizer,
];

/**
 * Creates a summarizer instance based on availability.
 * @param {SummarizerOptions} options - Options for creating the summarizer.
 * @returns {Promise<PromptApiSummarizer|NativeSummarizer|T5Summarizer>} A promise that resolves to an instance of a summarizer.
 * @throws {Error} If no summarizer is available.
 */
export async function createSummarizer({ onProgress = () => { }, signal } = {}) {
  
  for (const summarizerClass of summarizers) {
    if (await summarizerClass.isAvailable()) {
      try {
        // must be return await to catch the error in this function
        return await summarizerClass.create({ onProgress, signal });
      } catch (error) {
        console.warn(`Failed to create summarizer: ${summarizerClass.name}`, error);
      }
    }
  }
  
  // If no summarizer is available, throw an error 
  throw new Error('No summarizer available.');
}
