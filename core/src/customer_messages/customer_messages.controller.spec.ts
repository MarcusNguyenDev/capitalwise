import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';

import { CallEndedError } from '../calls/errors/call_ended.error';
import { CallNotFoundError } from '../calls/errors/call_not_found.error';
import { collectValidationMessages } from '../shared_kernel/collect_validation_messages.util';
import { RequestValidationError } from '../shared_kernel/errors/request_validation.error';
import { HttpErrorFilter } from '../shared_kernel/filters/http_error.filter';
import { CustomerMessagesController } from './customer_messages.controller';
import { CustomerMessagesService } from './customer_messages.service';
import { CallNotLiveError } from './errors/call_not_live.error';
import { VoiceAgentNotRunningError } from './errors/voice_agent_not_running.error';

const CALL_ID = '0b0f7c0e-5d3a-4f6e-9a55-3a3f3a3f3a3f';
const MESSAGE_PATH = `/calls/${CALL_ID}/customer_messages`;

// The HTTP contract, with the same validation pipe and error filter as main.ts.
describe('CustomerMessagesController', () => {
  let app: INestApplication;
  const customer_messages_service = { sendCustomerMessage: jest.fn() };

  beforeAll(async () => {
    const testing_module = await Test.createTestingModule({
      controllers: [CustomerMessagesController],
      providers: [
        {
          provide: CustomerMessagesService,
          useValue: customer_messages_service,
        },
      ],
    }).compile();
    app = testing_module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
        exceptionFactory: (validation_errors) =>
          new RequestValidationError(
            collectValidationMessages(validation_errors),
          ),
      }),
    );
    app.useGlobalFilters(new HttpErrorFilter());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    customer_messages_service.sendCustomerMessage.mockReset();
  });

  it('accepts a line with 202 { is_accepted: true }', async () => {
    customer_messages_service.sendCustomerMessage.mockResolvedValue({
      is_accepted: true,
    });

    await request(app.getHttpServer())
      .post(MESSAGE_PATH)
      .send({ text: 'I was charged twice yesterday.' })
      .expect(202, { is_accepted: true });

    expect(customer_messages_service.sendCustomerMessage).toHaveBeenCalledWith(
      CALL_ID,
      { text: 'I was charged twice yesterday.' },
    );
  });

  it.each([
    ['an empty line', { text: '' }],
    ['only spaces', { text: '   ' }],
    ['more than 500 characters', { text: 'a'.repeat(501) }],
    ['no text', {}],
    ['an unknown field', { text: 'Hi', speaker: 'AI' }],
  ])('rejects %s with 400', async (_case_label, request_body) => {
    const response = await request(app.getHttpServer())
      .post(MESSAGE_PATH)
      .send(request_body)
      .expect(400);

    expect(response.body.error_code).toBe('VALIDATION_FAILED');
    expect(
      customer_messages_service.sendCustomerMessage,
    ).not.toHaveBeenCalled();
  });

  it('accepts exactly 500 characters', async () => {
    customer_messages_service.sendCustomerMessage.mockResolvedValue({
      is_accepted: true,
    });

    await request(app.getHttpServer())
      .post(MESSAGE_PATH)
      .send({ text: 'a'.repeat(500) })
      .expect(202);
  });

  it.each([
    [new CallNotFoundError(CALL_ID), 404, 'CALL_NOT_FOUND'],
    [new CallEndedError(CALL_ID), 409, 'CALL_ENDED'],
    [new CallNotLiveError(CALL_ID), 409, 'CALL_NOT_LIVE'],
    [new VoiceAgentNotRunningError(CALL_ID), 409, 'VOICE_AGENT_NOT_RUNNING'],
  ])('answers %p with %i', async (service_error, status_code, error_code) => {
    customer_messages_service.sendCustomerMessage.mockRejectedValue(
      service_error,
    );

    const response = await request(app.getHttpServer())
      .post(MESSAGE_PATH)
      .send({ text: 'Hello' })
      .expect(status_code);

    expect(response.body.error_code).toBe(error_code);
  });

  it('rejects a call id that is not a UUID with 400', async () => {
    await request(app.getHttpServer())
      .post('/calls/not-a-call/customer_messages')
      .send({ text: 'Hello' })
      .expect(400);
  });
});
