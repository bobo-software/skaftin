import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Bell, Power, PowerOff, TestTube, Smartphone, X } from 'lucide-react';
import CommunicationsService, {
  PushDeviceToken,
  PushSettings,
} from '../../../../../services/CommunicationsService';
import ToastUtils from '../../../../../utils/ToastUtils';

const PushComsTab = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const [settings, setSettings] = useState<PushSettings | null>(null);
  const [tokens, setTokens] = useState<PushDeviceToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [showTestModal, setShowTestModal] = useState(false);
  const [testingToken, setTestingToken] = useState<PushDeviceToken | null>(null);
  const [sendingTest, setSendingTest] = useState(false);
  const [testForm, setTestForm] = useState({
    user_id: '',
    title: 'Test notification',
    body: 'This is a test push from Skaftin Communications.',
  });

  useEffect(() => {
    if (projectId) {
      loadAll();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const loadAll = async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      // Sequential: both endpoints ensure the project token table; avoid racing CREATE TABLE.
      const pushSettings = await CommunicationsService.getPushSettings(projectId);
      const pushTokens = await CommunicationsService.listPushTokens(projectId);
      setSettings(pushSettings);
      setTokens(pushTokens);
    } catch (error: any) {
      ToastUtils.error(error.message || 'Failed to load push notifications');
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async () => {
    if (!projectId || !settings || toggling) return;
    setToggling(true);
    try {
      const next = !settings.is_active;
      const updated = await CommunicationsService.updatePushSettings(projectId, next);
      setSettings(updated);
      ToastUtils.success(next ? 'Push notifications enabled' : 'Push notifications paused (tokens kept)');
    } catch (error: any) {
      ToastUtils.error(error.message || 'Failed to update push settings');
    } finally {
      setToggling(false);
    }
  };

  const openTestForToken = (token: PushDeviceToken) => {
    setTestingToken(token);
    setTestForm({
      user_id: String(token.user_id),
      title: 'Test notification',
      body: 'This is a test push from Skaftin Communications.',
    });
    setShowTestModal(true);
  };

  const openTestForUser = () => {
    setTestingToken(null);
    setTestForm({
      user_id: '',
      title: 'Test notification',
      body: 'This is a test push from Skaftin Communications.',
    });
    setShowTestModal(true);
  };

  const handleSendTest = async () => {
    if (!projectId) return;
    setSendingTest(true);
    try {
      const payload: { user_id?: number; token_id?: number; title: string; body: string } = {
        title: testForm.title.trim(),
        body: testForm.body.trim(),
      };
      if (testingToken) {
        payload.token_id = testingToken.id;
      } else {
        const userId = Number(testForm.user_id);
        if (!userId || userId <= 0) {
          ToastUtils.error('Enter a valid user ID');
          setSendingTest(false);
          return;
        }
        payload.user_id = userId;
      }
      const result = await CommunicationsService.testPush(projectId, payload);
      ToastUtils.success(`Sent ${result.sent} of ${result.targeted} device(s)`);
      setShowTestModal(false);
      await loadAll();
    } catch (error: any) {
      ToastUtils.error(error.message || 'Failed to send test push');
    } finally {
      setSendingTest(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 text-dark-600 dark:text-dark-400">Loading push notifications…</div>
    );
  }

  const isActive = settings?.is_active === true;

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-dark-900 dark:text-white flex items-center gap-2">
            <Bell className="w-5 h-5 text-primary-600" />
            Push notifications
          </h2>
          <p className="text-sm text-dark-600 dark:text-dark-400 mt-1">
            Register Expo device tokens from your app, then send test pushes. Turning this off pauses
            sending without deleting registered devices.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={openTestForUser}
            disabled={!isActive || tokens.length === 0}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded-lg border border-dark-200 dark:border-dark-600 text-dark-700 dark:text-dark-200 hover:bg-dark-50 dark:hover:bg-dark-800 disabled:opacity-50"
          >
            <TestTube className="w-4 h-4" />
            Send test
          </button>
          <button
            type="button"
            onClick={handleToggle}
            disabled={toggling || !settings}
            className={`inline-flex items-center gap-2 px-3 py-2 text-sm rounded-lg text-white disabled:opacity-50 ${
              isActive
                ? 'bg-emerald-600 hover:bg-emerald-700'
                : 'bg-dark-500 hover:bg-dark-600'
            }`}
            title={isActive ? 'Pause push (keep tokens)' : 'Enable push'}
          >
            {isActive ? <Power className="w-4 h-4" /> : <PowerOff className="w-4 h-4" />}
            {isActive ? 'Enabled' : 'Paused'}
          </button>
        </div>
      </div>

      {!isActive && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/30 px-4 py-3 text-sm text-amber-900 dark:text-amber-200">
          Push is paused. Clients cannot register new tokens and test sends are blocked. Existing
          device rows are kept.
        </div>
      )}

      <div className="rounded-lg border border-dark-200 dark:border-dark-700 overflow-hidden">
        <div className="px-4 py-3 border-b border-dark-200 dark:border-dark-700 flex items-center gap-2">
          <Smartphone className="w-4 h-4 text-dark-500" />
          <span className="font-medium text-dark-900 dark:text-white">Registered devices</span>
          <span className="text-sm text-dark-500">({tokens.length})</span>
        </div>
        {tokens.length === 0 ? (
          <div className="p-6 text-sm text-dark-600 dark:text-dark-400">
            No devices registered yet. Clients should call{' '}
            <code className="text-xs bg-dark-100 dark:bg-dark-800 px-1 rounded">
              POST /app-api/communications/push/register
            </code>{' '}
            with <code className="text-xs">user_id</code>, <code className="text-xs">platform</code>{' '}
            (<code className="text-xs">ios</code> / <code className="text-xs">android</code>), and{' '}
            <code className="text-xs">expo_push_token</code>.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-dark-50 dark:bg-dark-800/50 text-left text-dark-600 dark:text-dark-300">
                <tr>
                  <th className="px-4 py-2 font-medium">User ID</th>
                  <th className="px-4 py-2 font-medium">Platform</th>
                  <th className="px-4 py-2 font-medium">Device</th>
                  <th className="px-4 py-2 font-medium">Token</th>
                  <th className="px-4 py-2 font-medium">Last seen</th>
                  <th className="px-4 py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-200 dark:divide-dark-700">
                {tokens.map((token) => (
                  <tr key={token.id} className="text-dark-800 dark:text-dark-200">
                    <td className="px-4 py-2">{token.user_id}</td>
                    <td className="px-4 py-2 capitalize">{token.platform}</td>
                    <td className="px-4 py-2">{token.device_name || '—'}</td>
                    <td className="px-4 py-2 font-mono text-xs">
                      {token.token_preview || token.expo_push_token}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap">
                      {token.last_seen_at ? new Date(token.last_seen_at).toLocaleString() : '—'}
                    </td>
                    <td className="px-4 py-2">
                      <button
                        type="button"
                        onClick={() => openTestForToken(token)}
                        disabled={!isActive}
                        className="inline-flex items-center gap-1 text-primary-600 hover:text-primary-700 disabled:opacity-40"
                      >
                        <TestTube className="w-4 h-4" />
                        Test
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showTestModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white dark:bg-dark-900 border border-dark-200 dark:border-dark-700 shadow-xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-dark-200 dark:border-dark-700">
              <h3 className="font-semibold text-dark-900 dark:text-white">Send test push</h3>
              <button
                type="button"
                onClick={() => setShowTestModal(false)}
                className="text-dark-500 hover:text-dark-700 dark:hover:text-dark-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              {testingToken ? (
                <p className="text-sm text-dark-600 dark:text-dark-400">
                  Device #{testingToken.id} · user {testingToken.user_id} · {testingToken.platform}
                </p>
              ) : (
                <label className="block text-sm">
                  <span className="text-dark-700 dark:text-dark-300">User ID</span>
                  <input
                    type="number"
                    value={testForm.user_id}
                    onChange={(e) => setTestForm({ ...testForm, user_id: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-dark-200 dark:border-dark-600 bg-white dark:bg-dark-800 px-3 py-2"
                    placeholder="App user id"
                  />
                </label>
              )}
              <label className="block text-sm">
                <span className="text-dark-700 dark:text-dark-300">Title</span>
                <input
                  type="text"
                  value={testForm.title}
                  onChange={(e) => setTestForm({ ...testForm, title: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-dark-200 dark:border-dark-600 bg-white dark:bg-dark-800 px-3 py-2"
                />
              </label>
              <label className="block text-sm">
                <span className="text-dark-700 dark:text-dark-300">Body</span>
                <textarea
                  value={testForm.body}
                  onChange={(e) => setTestForm({ ...testForm, body: e.target.value })}
                  rows={3}
                  className="mt-1 w-full rounded-lg border border-dark-200 dark:border-dark-600 bg-white dark:bg-dark-800 px-3 py-2"
                />
              </label>
            </div>
            <div className="flex justify-end gap-2 px-4 py-3 border-t border-dark-200 dark:border-dark-700">
              <button
                type="button"
                onClick={() => setShowTestModal(false)}
                className="px-3 py-2 text-sm rounded-lg border border-dark-200 dark:border-dark-600"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSendTest}
                disabled={sendingTest}
                className="px-3 py-2 text-sm rounded-lg bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50"
              >
                {sendingTest ? 'Sending…' : 'Send'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PushComsTab;
