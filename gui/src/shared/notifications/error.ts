import { sprintf } from 'sprintf-js';
import { hasExpired } from '../account-expiry';
import { AuthFailureKind, parseAuthFailure } from '../auth-failure';
import {
  IErrorState,
  TunnelState,
  TunnelParameterError,
  ErrorStateCause,
  FirewallPolicyError,
} from '../daemon-rpc-types';
import { messages } from '../gettext';
import {
  InAppNotification,
  InAppNotificationProvider,
  SystemNotificationProvider,
} from './notification';

interface ErrorNotificationContext {
  tunnelState: TunnelState;
  accountExpiry?: string;
}

export class ErrorNotificationProvider
  implements SystemNotificationProvider, InAppNotificationProvider {
  public constructor(private context: ErrorNotificationContext) {}

  public mayDisplay = () => this.context.tunnelState.state === 'error';

  public getSystemNotification() {
    return this.context.tunnelState.state === 'error'
      ? {
          message: getSystemNotificationMessage(
            this.context.tunnelState,
            this.context.accountExpiry,
          ),
          critical: !!this.context.tunnelState.details.blockFailure,
        }
      : undefined;
  }

  public getInAppNotification(): InAppNotification | undefined {
    return this.context.tunnelState.state === 'error'
      ? {
          indicator: 'error',
          title: !this.context.tunnelState.details.blockFailure
            ? messages.pgettext('in-app-notifications', 'BLOCKING INTERNET')
            : messages.pgettext('in-app-notifications', 'YOU MIGHT BE LEAKING NETWORK TRAFFIC'),
          subtitle: getInAppNotificationSubtitle(this.context.tunnelState),
        }
      : undefined;
  }
}

function getSystemNotificationMessage(
  tunnelState: { state: 'error'; details: IErrorState },
  accountExpiry?: string,
) {
  if (tunnelState.details.blockFailure) {
    return messages.pgettext('notifications', 'Critical error (your attention is required)');
  } else if (
    (tunnelState.details.cause.reason === 'auth_failed' &&
      parseAuthFailure(tunnelState.details.cause.details).kind ===
        AuthFailureKind.expiredAccount) ||
    (accountExpiry && hasExpired(accountExpiry))
  ) {
    return sprintf('%(blocking)s %(message)s', {
      blocking: messages.pgettext('notifications', 'Blocking internet:'),
      message: messages.pgettext(
        'notifications',
        'You have no more VPN time left on this account.',
      ),
    });
  } else if (
    tunnelState.details.cause.reason === 'tunnel_parameter_error' &&
    tunnelState.details.cause.details === 'no_wireguard_key'
  ) {
    return messages.pgettext('notifications', 'Blocking internet: Valid WireGuard key is missing');
  } else {
    return messages.pgettext('notifications', 'Blocking internet');
  }
}

function getInAppNotificationSubtitle(tunnelState: { state: 'error'; details: IErrorState }) {
  let blockFailureMessage = null;
  if (tunnelState.details.blockFailure) {
    const extraMessage = getPolicyMessage(tunnelState.details.blockFailure);
    blockFailureMessage = `${messages.pgettext(
      'in-app-notifications',
      'Failed to block all network traffic',
    )}${extraMessage ? '. ' + extraMessage : ''}`;
  }

  const blockMessage = getBlockMessage(tunnelState.details.cause);
  return blockFailureMessage
    ? `${blockFailureMessage}. ${messages.pgettext(
        'in-app-notifications',
        'Original block reason',
      )}: ${blockMessage}`
    : blockMessage;
}

function getBlockMessage(blockReason: ErrorStateCause): string {
  switch (blockReason.reason) {
    case 'auth_failed':
      return parseAuthFailure(blockReason.details).message;
    case 'ipv6_unavailable':
      return messages.pgettext(
        'in-app-notifications',
        'Could not configure IPv6, please enable it on your system or disable it in the app',
      );
    case 'set_firewall_policy_error': {
      const extraMessage = getPolicyMessage(blockReason.details);
      return `${messages.pgettext(
        'in-app-notifications',
        'Failed to apply firewall rules. The device might currently be unsecured',
      )}${extraMessage ? '. ' + extraMessage : ''}`;
    }
    case 'set_dns_error':
      return messages.pgettext('in-app-notifications', 'Failed to set system DNS server');
    case 'start_tunnel_error':
      return messages.pgettext('in-app-notifications', 'Failed to start tunnel connection');
    case 'tunnel_parameter_error':
      return getTunnelParameterMessage(blockReason.details);
    case 'is_offline':
      return messages.pgettext(
        'in-app-notifications',
        'This device is offline, no tunnels can be established',
      );
    case 'virtual_adapter_problem':
      return messages.pgettext(
        'in-app-notifications',
        "Unable to detect a working virtual adapter on this device. If you've disabled it, enable it again. Otherwise, please reinstall the app",
      );
  }
}

function getPolicyMessage(err: FirewallPolicyError): string | null {
  let extraMessage = null;
  switch (process.platform) {
    case 'linux':
      extraMessage = messages.pgettext('in-app-notifications', 'Your kernel may be outdated');
      break;
    case 'win32':
      switch (err.reason) {
        case 'locked':
          if (err.details) {
            // TODO: Check if this message is ok
            extraMessage = `${messages.pgettext(
              'in-app-notifications',
              'An application prevented the policy from being set',
            )}: ${err.details.name}`;
          } else {
            extraMessage = messages.pgettext(
              'in-app-notifications',
              'This might be caused by third party security software',
            );
          }
          break;
      }
      break;
  }
  return extraMessage;
}

function getTunnelParameterMessage(err: TunnelParameterError): string {
  switch (err) {
    /// TODO: once bridge constraints can be set, add a more descriptive error message
    case 'no_matching_bridge_relay':
    case 'no_matching_relay':
      return messages.pgettext(
        'in-app-notifications',
        'No relay server matches the current settings. You can try changing the location or the relay settings.',
      );
    case 'no_wireguard_key':
      return messages.pgettext(
        'in-app-notifications',
        'Valid WireGuard key is missing. Manage keys under Advanced settings.',
      );
    case 'custom_tunnel_host_resultion_error':
      return messages.pgettext(
        'in-app-notifications',
        'Failed to resolve host of custom tunnel. Consider changing the settings',
      );
  }
}
