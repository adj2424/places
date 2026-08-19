import { Writable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { GoogleNotFoundError } from '../../../src/places/domain/errors.js';
import { createLogger } from '../../../src/shared/logging/logger.js';

function createCaptureStream(): { stream: Writable; getText: () => string } {
  const chunks: Buffer[] = [];
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      callback();
    },
  });

  return {
    stream,
    getText: () => Buffer.concat(chunks).toString('utf8'),
  };
}

function parseLines(text: string): Record<string, unknown>[] {
  return text
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as Record<string, unknown>);
}

describe('createLogger', () => {
  it('silent suppresses all severities including error', () => {
    const capture = createCaptureStream();
    createLogger('silent', capture.stream).error({ a: 1 }, 'x');

    expect(capture.getText()).toBe('');
  });

  it('error min-level filters info but emits error', () => {
    const capture = createCaptureStream();
    const logger = createLogger('error', capture.stream);

    logger.info({ port: 3000 }, 'listening');
    logger.error({ reason: 'busy' }, 'startup failed');

    const lines = parseLines(capture.getText());
    expect(lines).toHaveLength(1);
    const line = lines[0]!;
    expect(line.msg).toBe('startup failed');
    expect(line.reason).toBe('busy');
  });

  it('info min-level preserves extras on error without throwing', () => {
    const capture = createCaptureStream();
    const logger = createLogger('info', capture.stream);

    logger.error({ status: 500, error: { nested: true } }, 'google request failed');

    const lines = parseLines(capture.getText());
    expect(lines).toHaveLength(1);
    const line = lines[0]!;
    expect(line.msg).toBe('google request failed');
    expect(line.status).toBe(500);
    expect(line.error).toEqual({ nested: true });
  });

  it('info min-level emits listening with port extra', () => {
    const capture = createCaptureStream();
    const logger = createLogger('info', capture.stream);

    logger.info({ port: 3000 }, 'listening');

    const lines = parseLines(capture.getText());
    expect(lines).toHaveLength(1);
    const line = lines[0]!;
    expect(line.msg).toBe('listening');
    expect(line.port).toBe(3000);
  });

  it('does not throw when extra cannot be JSON-cloned', () => {
    const capture = createCaptureStream();
    const logger = createLogger('info', capture.stream);
    const circular: Record<string, unknown> = {};
    circular.self = circular;

    logger.info({ circular }, 'still logs');

    const lines = parseLines(capture.getText());
    expect(lines).toHaveLength(1);
    expect(lines[0]!.msg).toBe('still logs');
  });

  it('fatal min-level suppresses error', () => {
    const capture = createCaptureStream();
    createLogger('fatal', capture.stream).error('x');

    expect(capture.getText()).toBe('');
  });

  it('child bindings appear on log lines', () => {
    const capture = createCaptureStream();
    const logger = createLogger('info', capture.stream).child({ component: 'places' });

    logger.info('google request successful');

    const lines = parseLines(capture.getText());
    expect(lines).toHaveLength(1);
    const line = lines[0]!;
    expect(line.msg).toBe('google request successful');
    expect(line.component).toBe('places');
  });

  it('serializes Error.message under the error key', () => {
    const capture = createCaptureStream();
    const logger = createLogger('info', capture.stream);

    logger.error({ error: new GoogleNotFoundError(12) }, 'error finding places');

    const lines = parseLines(capture.getText());
    expect(lines).toHaveLength(1);
    const line = lines[0]!;
    expect(line.msg).toBe('error finding places');
    expect(line.error).toMatchObject({
      message: 'google not found',
      durationMs: 12
    });
  });

  it('nested child bindings merge', () => {
    const capture = createCaptureStream();
    const logger = createLogger('info', capture.stream)
      .child({ component: 'health' })
      .child({ adapter: 'routes' });

    logger.info({ status: 'ok' }, 'health check result');

    const lines = parseLines(capture.getText());
    expect(lines).toHaveLength(1);
    const line = lines[0]!;
    expect(line.component).toBe('health');
    expect(line.adapter).toBe('routes');
    expect(line.status).toBe('ok');
  });
});
