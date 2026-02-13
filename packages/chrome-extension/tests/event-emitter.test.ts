import { describe, it } from 'node:test';
import assert from 'node:assert';
import { createEventEmitter } from '../src/event-emitter.js';

describe('EventEmitter', () => {
	it('calls listener when event is emitted', () => {
		const emitter = createEventEmitter();
		let called = false;
		let receivedArg: unknown;

		emitter.on('test', (arg) => {
			called = true;
			receivedArg = arg;
		});

		emitter.emit('test', 'hello');

		assert.strictEqual(called, true);
		assert.strictEqual(receivedArg, 'hello');
	});

	it('calls multiple listeners for the same event', () => {
		const emitter = createEventEmitter();
		const calls: string[] = [];

		emitter.on('test', () => calls.push('first'));
		emitter.on('test', () => calls.push('second'));
		emitter.on('test', () => calls.push('third'));

		emitter.emit('test');

		assert.deepStrictEqual(calls, ['first', 'second', 'third']);
	});

	it('passes multiple arguments to listeners', () => {
		const emitter = createEventEmitter();
		let args: unknown[];

		emitter.on('test', (...received) => {
			args = received;
		});

		emitter.emit('test', 1, 'two', { three: 3 });

		assert.deepStrictEqual(args!, [1, 'two', { three: 3 }]);
	});

	it('does nothing when emitting event with no listeners', () => {
		const emitter = createEventEmitter();
		emitter.emit('nonexistent');
		assert.ok(true);
	});

	it('removes listener with off', () => {
		const emitter = createEventEmitter();
		let callCount = 0;

		const listener = () => {
			callCount++;
		};

		emitter.on('test', listener);
		emitter.emit('test');
		assert.strictEqual(callCount, 1);

		emitter.off('test', listener);
		emitter.emit('test');
		assert.strictEqual(callCount, 1, 'Listener should not be called after off');
	});

	it('off does nothing for non-existent event', () => {
		const emitter = createEventEmitter();
		emitter.off('nonexistent', () => { });
		assert.ok(true);
	});

	it('off does nothing for non-existent listener', () => {
		const emitter = createEventEmitter();
		emitter.on('test', () => { });
		emitter.off('test', () => { });
		assert.ok(true);
	});

	it('removes only the specified listener', () => {
		const emitter = createEventEmitter();
		const calls: string[] = [];

		const listener1 = () => calls.push('1');
		const listener2 = () => calls.push('2');

		emitter.on('test', listener1);
		emitter.on('test', listener2);

		emitter.off('test', listener1);
		emitter.emit('test');

		assert.deepStrictEqual(calls, ['2']);
	});

	it('supports multiple events independently', () => {
		const emitter = createEventEmitter();
		const events: string[] = [];

		emitter.on('event1', () => events.push('e1'));
		emitter.on('event2', () => events.push('e2'));

		emitter.emit('event1');
		emitter.emit('event2');

		assert.deepStrictEqual(events, ['e1', 'e2']);
	});
});
