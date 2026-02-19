import { useState } from 'react';
import {
  X,
  Send,
  MessageSquare,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Loader2,
  Phone,
  Copy,
  Check,
  FileText,
  Plus,
  Trash2,
} from 'lucide-react';
import CommunicationsService from '../../services/CommunicationsService';
import ToastUtils from '../../utils/ToastUtils';

interface TwilioTestModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
}

type TabType = 'sms' | 'whatsapp' | 'wa-template' | 'status';

interface SendResult {
  sid?: string;
  status?: string;
  to?: string;
  from?: string;
  errorCode?: number | null;
  errorMessage?: string | null;
  errorCodeExplanation?: string | null;
  troubleshooting?: string | null;
  [key: string]: any;
}

interface StatusResult {
  messageSid?: string;
  status?: string;
  to?: string;
  from?: string;
  body?: string;
  errorCode?: number | null;
  errorMessage?: string | null;
  errorCodeExplanation?: string | null;
  statusExplanation?: string;
  troubleshooting?: string | null;
  price?: string | null;
  priceUnit?: string | null;
  dateCreated?: string | null;
  dateSent?: string | null;
  dateUpdated?: string | null;
}

const STATUS_COLORS: Record<string, { bg: string; text: string; icon: typeof CheckCircle2 }> = {
  delivered: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-300', icon: CheckCircle2 },
  sent: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-300', icon: Send },
  read: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-300', icon: CheckCircle2 },
  queued: { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-700 dark:text-yellow-300', icon: Clock },
  sending: { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-700 dark:text-yellow-300', icon: Clock },
  failed: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-300', icon: XCircle },
  undelivered: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-300', icon: XCircle },
};

const TwilioTestModal = ({ isOpen, onClose, projectId }: TwilioTestModalProps) => {
  const [activeTab, setActiveTab] = useState<TabType>('sms');
  const [destination, setDestination] = useState('');
  const [message, setMessage] = useState('Hello from Skaftin!');
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<SendResult | null>(null);

  const [statusSid, setStatusSid] = useState('');
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [statusResult, setStatusResult] = useState<StatusResult | null>(null);

  const [templatePhone, setTemplatePhone] = useState('');
  const [contentSid, setContentSid] = useState('');
  const [contentVars, setContentVars] = useState<{ key: string; value: string }[]>([
    { key: '1', value: '' },
  ]);
  const [sendingTemplate, setSendingTemplate] = useState(false);
  const [templateResult, setTemplateResult] = useState<SendResult | null>(null);

  const [copiedSid, setCopiedSid] = useState(false);

  if (!isOpen) return null;

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!destination.trim() || !message.trim()) {
      ToastUtils.error('Enter destination and message');
      return;
    }

    setSending(true);
    setSendResult(null);

    try {
      let data: any;
      if (activeTab === 'sms') {
        data = await CommunicationsService.sendSms(projectId, [
          { destination: destination.trim(), content: message.trim() },
        ]);
      } else {
        data = await CommunicationsService.sendWhatsApp(projectId, [
          { destination: destination.trim(), content: message.trim() },
        ]);
      }

      // data is an array of results
      const result = Array.isArray(data) ? data[0] : data;
      setSendResult(result);

      // Auto-populate status SID for easy lookup
      if (result?.sid) {
        setStatusSid(result.sid);
      }

      ToastUtils.success(`Test ${activeTab === 'sms' ? 'SMS' : 'WhatsApp'} sent`);
    } catch (err: any) {
      ToastUtils.error(err.message || `Failed to send ${activeTab === 'sms' ? 'SMS' : 'WhatsApp'}`);
      setSendResult({ errorMessage: err.message });
    } finally {
      setSending(false);
    }
  };

  const handleSendTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!templatePhone.trim() || !contentSid.trim()) {
      ToastUtils.error('Enter phone number and Content SID');
      return;
    }

    setSendingTemplate(true);
    setTemplateResult(null);

    try {
      const variables: Record<string, string> = {};
      for (const v of contentVars) {
        if (v.key.trim() && v.value.trim()) {
          variables[v.key.trim()] = v.value.trim();
        }
      }

      const data = await CommunicationsService.sendWhatsAppTemplate(
        projectId,
        templatePhone.trim(),
        contentSid.trim(),
        Object.keys(variables).length > 0 ? variables : undefined
      );

      const result = Array.isArray(data) ? data[0] : data;
      setTemplateResult(result);

      if (result?.sid) {
        setStatusSid(result.sid);
      }

      ToastUtils.success('WhatsApp template message sent');
    } catch (err: any) {
      ToastUtils.error(err.message || 'Failed to send WhatsApp template');
      setTemplateResult({ errorMessage: err.message });
    } finally {
      setSendingTemplate(false);
    }
  };

  const handleAddVariable = () => {
    const nextKey = String(contentVars.length + 1);
    setContentVars([...contentVars, { key: nextKey, value: '' }]);
  };

  const handleRemoveVariable = (index: number) => {
    if (contentVars.length <= 1) return;
    setContentVars(contentVars.filter((_, i) => i !== index));
  };

  const handleVariableChange = (index: number, field: 'key' | 'value', val: string) => {
    const updated = [...contentVars];
    updated[index] = { ...updated[index], [field]: val };
    setContentVars(updated);
  };

  const handleCheckStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!statusSid.trim()) {
      ToastUtils.error('Enter a message SID');
      return;
    }

    setCheckingStatus(true);
    setStatusResult(null);

    try {
      const data = await CommunicationsService.checkMessageStatus(projectId, statusSid.trim());
      setStatusResult(data);
    } catch (err: any) {
      ToastUtils.error(err.message || 'Failed to check message status');
      setStatusResult({ errorMessage: err.message } as any);
    } finally {
      setCheckingStatus(false);
    }
  };

  const handleCopySid = (sid: string) => {
    navigator.clipboard.writeText(sid);
    setCopiedSid(true);
    setTimeout(() => setCopiedSid(false), 2000);
  };

  const handleClose = () => {
    setSendResult(null);
    setStatusResult(null);
    setTemplateResult(null);
    onClose();
  };

  const getStatusStyle = (status?: string) => {
    if (!status) return STATUS_COLORS.queued;
    return STATUS_COLORS[status] || STATUS_COLORS.queued;
  };

  const tabs: { id: TabType; label: string; icon: typeof MessageSquare }[] = [
    { id: 'sms', label: 'SMS', icon: MessageSquare },
    { id: 'whatsapp', label: 'WhatsApp', icon: Phone },
    { id: 'wa-template', label: 'WA Template', icon: FileText },
    { id: 'status', label: 'Status', icon: Search },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-dark-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-dark-200 dark:border-dark-700 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-dark-900 dark:text-white">
                Twilio Test Console
              </h2>
              <p className="text-xs text-dark-500 dark:text-dark-400">
                Send test messages and check delivery status
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 text-dark-400 hover:text-dark-600 dark:hover:text-dark-300 rounded-lg hover:bg-dark-100 dark:hover:bg-dark-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-dark-200 dark:border-dark-700 flex-shrink-0">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  setSendResult(null);
                  setStatusResult(null);
                  setTemplateResult(null);
                }}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-3 text-sm font-medium transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'text-primary-600 dark:text-primary-400 border-b-2 border-primary-600 dark:border-primary-400 bg-primary-50/50 dark:bg-primary-900/10'
                    : 'text-dark-500 dark:text-dark-400 hover:text-dark-700 dark:hover:text-dark-300 hover:bg-dark-50 dark:hover:bg-dark-700/50'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {/* SMS / WhatsApp tab */}
          {(activeTab === 'sms' || activeTab === 'whatsapp') && (
            <form onSubmit={handleSend} className="space-y-4">
              {/* Info banner */}
              {activeTab === 'whatsapp' && (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-700 dark:text-amber-300">
                      Recipient must have opted in to receive WhatsApp messages from your Twilio number.
                      For Sandbox testing, they need to send <strong>join [your-sandbox-code]</strong> first.
                    </p>
                  </div>
                </div>
              )}

              {/* Destination */}
              <div>
                <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-1.5">
                  Destination Phone Number
                </label>
                <input
                  type="text"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  className="w-full px-3 py-2.5 border border-dark-200 dark:border-dark-700 rounded-lg bg-white dark:bg-dark-900 text-dark-900 dark:text-white text-sm placeholder-dark-400"
                  placeholder={activeTab === 'whatsapp' ? '+27712345678 or 0712345678' : '+27712345678 or 0712345678'}
                  required
                />
                <p className="text-xs text-dark-400 dark:text-dark-500 mt-1">
                  SA numbers starting with 0 are auto-formatted to +27
                </p>
              </div>

              {/* Message */}
              <div>
                <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-1.5">
                  Message
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="w-full px-3 py-2.5 border border-dark-200 dark:border-dark-700 rounded-lg bg-white dark:bg-dark-900 text-dark-900 dark:text-white text-sm placeholder-dark-400 resize-none"
                  rows={3}
                  required
                  placeholder="Type your test message..."
                />
                <p className="text-xs text-dark-400 dark:text-dark-500 mt-1">
                  {message.length} characters
                </p>
              </div>

              {/* Send button */}
              <button
                type="submit"
                disabled={sending}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
              >
                {sending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Send Test {activeTab === 'sms' ? 'SMS' : 'WhatsApp'}
                  </>
                )}
              </button>

              {/* Send result */}
              {sendResult && (
                <div className="mt-4 space-y-3">
                  <h4 className="text-sm font-semibold text-dark-900 dark:text-white">Response</h4>

                  {/* Status badge */}
                  {sendResult.status && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-dark-500 dark:text-dark-400 w-16">Status</span>
                      {(() => {
                        const style = getStatusStyle(sendResult.status);
                        const Icon = style.icon;
                        return (
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${style.bg} ${style.text}`}>
                            <Icon className="w-3.5 h-3.5" />
                            {sendResult.status}
                          </span>
                        );
                      })()}
                    </div>
                  )}

                  {/* Message SID */}
                  {sendResult.sid && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-dark-500 dark:text-dark-400 w-16">SID</span>
                      <code className="flex-1 text-xs font-mono bg-dark-50 dark:bg-dark-900 text-dark-700 dark:text-dark-300 px-2 py-1 rounded truncate">
                        {sendResult.sid}
                      </code>
                      <button
                        type="button"
                        onClick={() => handleCopySid(sendResult.sid!)}
                        className="p-1 text-dark-400 hover:text-dark-600 dark:hover:text-dark-300 transition-colors"
                        title="Copy SID"
                      >
                        {copiedSid ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  )}

                  {/* To / From */}
                  {sendResult.to && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-dark-500 dark:text-dark-400 w-16">To</span>
                      <span className="text-xs text-dark-700 dark:text-dark-300">{sendResult.to}</span>
                    </div>
                  )}
                  {sendResult.from && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-dark-500 dark:text-dark-400 w-16">From</span>
                      <span className="text-xs text-dark-700 dark:text-dark-300">{sendResult.from}</span>
                    </div>
                  )}

                  {/* Error info */}
                  {(sendResult.errorCode || sendResult.errorMessage || sendResult.errorCodeExplanation) && (
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                      {sendResult.errorCode && (
                        <p className="text-xs font-medium text-red-700 dark:text-red-300 mb-1">
                          Error Code: {sendResult.errorCode}
                        </p>
                      )}
                      {sendResult.errorCodeExplanation && (
                        <p className="text-xs text-red-600 dark:text-red-400">{sendResult.errorCodeExplanation}</p>
                      )}
                      {sendResult.errorMessage && !sendResult.errorCodeExplanation && (
                        <p className="text-xs text-red-600 dark:text-red-400">{sendResult.errorMessage}</p>
                      )}
                    </div>
                  )}

                  {/* Troubleshooting */}
                  {sendResult.troubleshooting && (
                    <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                      <p className="text-xs font-medium text-amber-700 dark:text-amber-300 mb-1">Troubleshooting</p>
                      <p className="text-xs text-amber-600 dark:text-amber-400 whitespace-pre-line">{sendResult.troubleshooting}</p>
                    </div>
                  )}
                </div>
              )}
            </form>
          )}

          {/* WA Template tab */}
          {activeTab === 'wa-template' && (
            <form onSubmit={handleSendTemplate} className="space-y-4">
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-blue-700 dark:text-blue-300">
                    Send a pre-approved WhatsApp template using a Twilio Content SID (starts with <strong>HX</strong>).
                    Create templates in Twilio Console &rarr; Content &rarr; Content Templates.
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-1.5">
                  Destination Phone Number
                </label>
                <input
                  type="text"
                  value={templatePhone}
                  onChange={(e) => setTemplatePhone(e.target.value)}
                  className="w-full px-3 py-2.5 border border-dark-200 dark:border-dark-700 rounded-lg bg-white dark:bg-dark-900 text-dark-900 dark:text-white text-sm placeholder-dark-400"
                  placeholder="+27712345678 or 0712345678"
                  required
                />
                <p className="text-xs text-dark-400 dark:text-dark-500 mt-1">
                  SA numbers starting with 0 are auto-formatted to +27
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-1.5">
                  Content SID
                </label>
                <input
                  type="text"
                  value={contentSid}
                  onChange={(e) => setContentSid(e.target.value)}
                  className="w-full px-3 py-2.5 border border-dark-200 dark:border-dark-700 rounded-lg bg-white dark:bg-dark-900 text-dark-900 dark:text-white text-sm font-mono placeholder-dark-400"
                  placeholder="HX350d429d32e64a552466cafecbe95f3c"
                  required
                />
                <p className="text-xs text-dark-400 dark:text-dark-500 mt-1">
                  Found in Twilio Console &rarr; Content &rarr; Content Templates
                </p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-sm font-medium text-dark-700 dark:text-dark-300">
                    Template Variables
                  </label>
                  <button
                    type="button"
                    onClick={handleAddVariable}
                    className="flex items-center gap-1 text-xs text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add
                  </button>
                </div>
                <div className="space-y-2">
                  {contentVars.map((v, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={v.key}
                        onChange={(e) => handleVariableChange(i, 'key', e.target.value)}
                        className="w-16 px-2 py-2 border border-dark-200 dark:border-dark-700 rounded-lg bg-white dark:bg-dark-900 text-dark-900 dark:text-white text-sm text-center placeholder-dark-400"
                        placeholder="Key"
                      />
                      <span className="text-dark-400 text-xs">=</span>
                      <input
                        type="text"
                        value={v.value}
                        onChange={(e) => handleVariableChange(i, 'value', e.target.value)}
                        className="flex-1 px-3 py-2 border border-dark-200 dark:border-dark-700 rounded-lg bg-white dark:bg-dark-900 text-dark-900 dark:text-white text-sm placeholder-dark-400"
                        placeholder={`Value for {{${v.key}}}`}
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveVariable(i)}
                        disabled={contentVars.length <= 1}
                        className="p-1.5 text-dark-400 hover:text-red-500 dark:hover:text-red-400 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-dark-400 dark:text-dark-500 mt-1">
                  Keys match template placeholders (e.g. 1 &rarr; {'{{1}}'}, 2 &rarr; {'{{2}}'})
                </p>
              </div>

              <button
                type="submit"
                disabled={sendingTemplate}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
              >
                {sendingTemplate ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Send Template Message
                  </>
                )}
              </button>

              {templateResult && (
                <div className="mt-4 space-y-3">
                  <h4 className="text-sm font-semibold text-dark-900 dark:text-white">Response</h4>

                  {templateResult.status && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-dark-500 dark:text-dark-400 w-16">Status</span>
                      {(() => {
                        const style = getStatusStyle(templateResult.status);
                        const Icon = style.icon;
                        return (
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${style.bg} ${style.text}`}>
                            <Icon className="w-3.5 h-3.5" />
                            {templateResult.status}
                          </span>
                        );
                      })()}
                    </div>
                  )}

                  {templateResult.sid && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-dark-500 dark:text-dark-400 w-16">SID</span>
                      <code className="flex-1 text-xs font-mono bg-dark-50 dark:bg-dark-900 text-dark-700 dark:text-dark-300 px-2 py-1 rounded truncate">
                        {templateResult.sid}
                      </code>
                      <button
                        type="button"
                        onClick={() => handleCopySid(templateResult.sid!)}
                        className="p-1 text-dark-400 hover:text-dark-600 dark:hover:text-dark-300 transition-colors"
                        title="Copy SID"
                      >
                        {copiedSid ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  )}

                  {templateResult.to && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-dark-500 dark:text-dark-400 w-16">To</span>
                      <span className="text-xs text-dark-700 dark:text-dark-300">{templateResult.to}</span>
                    </div>
                  )}
                  {templateResult.from && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-dark-500 dark:text-dark-400 w-16">From</span>
                      <span className="text-xs text-dark-700 dark:text-dark-300">{templateResult.from}</span>
                    </div>
                  )}

                  {(templateResult.errorCode || templateResult.errorMessage || templateResult.errorCodeExplanation) && (
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                      {templateResult.errorCode && (
                        <p className="text-xs font-medium text-red-700 dark:text-red-300 mb-1">
                          Error Code: {templateResult.errorCode}
                        </p>
                      )}
                      {templateResult.errorCodeExplanation && (
                        <p className="text-xs text-red-600 dark:text-red-400">{templateResult.errorCodeExplanation}</p>
                      )}
                      {templateResult.errorMessage && !templateResult.errorCodeExplanation && (
                        <p className="text-xs text-red-600 dark:text-red-400">{templateResult.errorMessage}</p>
                      )}
                    </div>
                  )}

                  {templateResult.troubleshooting && (
                    <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                      <p className="text-xs font-medium text-amber-700 dark:text-amber-300 mb-1">Troubleshooting</p>
                      <p className="text-xs text-amber-600 dark:text-amber-400 whitespace-pre-line">{templateResult.troubleshooting}</p>
                    </div>
                  )}
                </div>
              )}
            </form>
          )}

          {/* Check Status tab */}
          {activeTab === 'status' && (
            <div className="space-y-4">
              <form onSubmit={handleCheckStatus} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-1.5">
                    Message SID
                  </label>
                  <input
                    type="text"
                    value={statusSid}
                    onChange={(e) => setStatusSid(e.target.value)}
                    className="w-full px-3 py-2.5 border border-dark-200 dark:border-dark-700 rounded-lg bg-white dark:bg-dark-900 text-dark-900 dark:text-white text-sm font-mono placeholder-dark-400"
                    placeholder="SM1234567890abcdef..."
                    required
                  />
                  <p className="text-xs text-dark-400 dark:text-dark-500 mt-1">
                    Paste the message SID returned from a send operation
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={checkingStatus}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                >
                  {checkingStatus ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Checking...
                    </>
                  ) : (
                    <>
                      <Search className="w-4 h-4" />
                      Check Status
                    </>
                  )}
                </button>
              </form>

              {/* Status result */}
              {statusResult && (
                <div className="space-y-3 border-t border-dark-200 dark:border-dark-700 pt-4">
                  <h4 className="text-sm font-semibold text-dark-900 dark:text-white">Message Details</h4>

                  {/* Status badge */}
                  {statusResult.status && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-dark-500 dark:text-dark-400 w-20">Status</span>
                      {(() => {
                        const style = getStatusStyle(statusResult.status);
                        const Icon = style.icon;
                        return (
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${style.bg} ${style.text}`}>
                            <Icon className="w-3.5 h-3.5" />
                            {statusResult.status}
                          </span>
                        );
                      })()}
                    </div>
                  )}

                  {/* Status explanation */}
                  {statusResult.statusExplanation && (
                    <div className="flex items-start gap-2">
                      <span className="text-xs font-medium text-dark-500 dark:text-dark-400 w-20 flex-shrink-0">Info</span>
                      <span className="text-xs text-dark-600 dark:text-dark-400">{statusResult.statusExplanation}</span>
                    </div>
                  )}

                  {/* To / From */}
                  {statusResult.to && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-dark-500 dark:text-dark-400 w-20">To</span>
                      <span className="text-xs text-dark-700 dark:text-dark-300">{statusResult.to}</span>
                    </div>
                  )}
                  {statusResult.from && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-dark-500 dark:text-dark-400 w-20">From</span>
                      <span className="text-xs text-dark-700 dark:text-dark-300">{statusResult.from}</span>
                    </div>
                  )}

                  {/* Body */}
                  {statusResult.body && (
                    <div className="flex items-start gap-2">
                      <span className="text-xs font-medium text-dark-500 dark:text-dark-400 w-20 flex-shrink-0">Body</span>
                      <span className="text-xs text-dark-700 dark:text-dark-300 bg-dark-50 dark:bg-dark-900 rounded px-2 py-1 flex-1">
                        {statusResult.body}
                      </span>
                    </div>
                  )}

                  {/* Dates */}
                  {statusResult.dateCreated && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-dark-500 dark:text-dark-400 w-20">Created</span>
                      <span className="text-xs text-dark-600 dark:text-dark-400">
                        {new Date(statusResult.dateCreated).toLocaleString()}
                      </span>
                    </div>
                  )}
                  {statusResult.dateSent && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-dark-500 dark:text-dark-400 w-20">Sent</span>
                      <span className="text-xs text-dark-600 dark:text-dark-400">
                        {new Date(statusResult.dateSent).toLocaleString()}
                      </span>
                    </div>
                  )}

                  {/* Price */}
                  {statusResult.price && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-dark-500 dark:text-dark-400 w-20">Cost</span>
                      <span className="text-xs text-dark-700 dark:text-dark-300">
                        {statusResult.price} {statusResult.priceUnit}
                      </span>
                    </div>
                  )}

                  {/* Error info */}
                  {(statusResult.errorCode || statusResult.errorCodeExplanation) && (
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                      {statusResult.errorCode && (
                        <p className="text-xs font-medium text-red-700 dark:text-red-300 mb-1">
                          Error Code: {statusResult.errorCode}
                        </p>
                      )}
                      {statusResult.errorCodeExplanation && (
                        <p className="text-xs text-red-600 dark:text-red-400">{statusResult.errorCodeExplanation}</p>
                      )}
                      {statusResult.errorMessage && !statusResult.errorCodeExplanation && (
                        <p className="text-xs text-red-600 dark:text-red-400">{statusResult.errorMessage}</p>
                      )}
                    </div>
                  )}

                  {/* Troubleshooting */}
                  {statusResult.troubleshooting && (
                    <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                      <p className="text-xs font-medium text-amber-700 dark:text-amber-300 mb-1">Troubleshooting</p>
                      <p className="text-xs text-amber-600 dark:text-amber-400 whitespace-pre-line">{statusResult.troubleshooting}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end p-4 border-t border-dark-200 dark:border-dark-700 bg-dark-50 dark:bg-dark-700/50 rounded-b-xl flex-shrink-0">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-sm font-medium text-dark-700 dark:text-dark-300 border border-dark-200 dark:border-dark-600 rounded-lg hover:bg-dark-100 dark:hover:bg-dark-600 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default TwilioTestModal;
