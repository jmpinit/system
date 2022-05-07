const LOG_LEVEL_ENV_VAR_NAME = 'LOG_LEVEL';

const LOG_LEVELS = ['error', 'warn', 'info', 'debug'];

const LOG_LEVEL_ERROR = 0;
const LOG_LEVEL_WARN = 1;
const LOG_LEVEL_INFO = 2;
const LOG_LEVEL_DEBUG = 3;

const DEFAULT_LOG_LEVEL = LOG_LEVEL_ERROR;

/**
 * Get the environment's current log level
 * @returns {number}
 */
function getLogLevel() {
  if (!(LOG_LEVEL_ENV_VAR_NAME in process.env)) {
    return DEFAULT_LOG_LEVEL;
  }

  const logEnvVar = process.env[LOG_LEVEL_ENV_VAR_NAME].toLowerCase();

  const logLevel = LOG_LEVELS.indexOf(logEnvVar);

  if (logLevel === -1) {
    console.warn('Unrecognized log level specified via LOG_LEVEL env var');
    return DEFAULT_LOG_LEVEL;
  }

  return logLevel;
}

export function logError(msg) {
  if (getLogLevel() < LOG_LEVEL_ERROR) {
    return;
  }

  console.log(msg);
}

export function logWarn(msg) {
  if (getLogLevel() < LOG_LEVEL_WARN) {
    return;
  }

  console.log(msg);
}

export function logInfo(msg) {
  if (getLogLevel() < LOG_LEVEL_INFO) {
    return;
  }

  console.log(msg);
}

export function logDebug(msg) {
  if (getLogLevel() < LOG_LEVEL_DEBUG) {
    return;
  }

  console.log(msg);
}
