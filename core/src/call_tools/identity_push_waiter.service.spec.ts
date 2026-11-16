import { LiveEventBus } from '../live/live_event_bus.service';
import { IdentityPushWaiter } from './identity_push_waiter.service';
import { NotificationStatusesRepository } from './notification_statuses.repository';

const CALL_ID = '0b0f7c0e-5d3a-4f6e-9a55-3a3f3a3f3a3f';
const IDENTITY_PUSH_WAIT = {
  notification_id: 'NTF-00001',
  call_id: CALL_ID,
  timeout_ms: 45_000,
};

function buildHarness() {
  const live_event_bus = new LiveEventBus();
  const notification_statuses_repository = {
    findStatus: jest.fn().mockResolvedValue('SENT'),
  };
  const identity_push_waiter = new IdentityPushWaiter(
    live_event_bus,
    notification_statuses_repository as unknown as NotificationStatusesRepository,
  );
  return {
    live_event_bus,
    notification_statuses_repository,
    identity_push_waiter,
  };
}

describe('IdentityPushWaiter', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('resolves with the customer answer from the live event and leaves no timer', async () => {
    const { live_event_bus, identity_push_waiter } = buildHarness();
    const answer_promise =
      identity_push_waiter.waitForAnswer(IDENTITY_PUSH_WAIT);

    live_event_bus.publish('notification.updated', {
      notification_id: 'NTF-00999',
      status: 'APPROVED',
    });
    live_event_bus.publish('notification.updated', {
      notification_id: 'NTF-00001',
      status: 'DENIED',
    });
    await jest.advanceTimersByTimeAsync(0);

    await expect(answer_promise).resolves.toBe('DENIED');
    expect(jest.getTimerCount()).toBe(0);
  });

  it('times out after 45 seconds without an answer', async () => {
    const { identity_push_waiter } = buildHarness();
    const answer_promise =
      identity_push_waiter.waitForAnswer(IDENTITY_PUSH_WAIT);

    await jest.advanceTimersByTimeAsync(44_000);
    await jest.advanceTimersByTimeAsync(1_500);

    await expect(answer_promise).resolves.toBe('TIMEOUT');
    expect(jest.getTimerCount()).toBe(0);
  });

  it('falls back to polling the notification when the live event is missed', async () => {
    const { notification_statuses_repository, identity_push_waiter } =
      buildHarness();
    notification_statuses_repository.findStatus
      .mockResolvedValueOnce('SENT')
      .mockResolvedValue('APPROVED');
    const answer_promise =
      identity_push_waiter.waitForAnswer(IDENTITY_PUSH_WAIT);

    await jest.advanceTimersByTimeAsync(3_100);

    await expect(answer_promise).resolves.toBe('APPROVED');
  });

  it('stops waiting when the call ends, the demo is reset or the service shuts down', async () => {
    const { live_event_bus, identity_push_waiter } = buildHarness();

    const ended_call_promise =
      identity_push_waiter.waitForAnswer(IDENTITY_PUSH_WAIT);
    live_event_bus.publish('internal.call_ended', { call_id: CALL_ID });
    await jest.advanceTimersByTimeAsync(0);
    await expect(ended_call_promise).resolves.toBe('CALL_GONE');

    const reset_promise =
      identity_push_waiter.waitForAnswer(IDENTITY_PUSH_WAIT);
    live_event_bus.publish('demo.reset', {});
    await jest.advanceTimersByTimeAsync(0);
    await expect(reset_promise).resolves.toBe('CALL_GONE');

    const shutdown_promise =
      identity_push_waiter.waitForAnswer(IDENTITY_PUSH_WAIT);
    identity_push_waiter.onModuleDestroy();
    await expect(shutdown_promise).resolves.toBe('CALL_GONE');
    expect(jest.getTimerCount()).toBe(0);
  });
});
