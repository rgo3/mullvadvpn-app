import { hasExpired } from '../account-expiry';
import { AuthFailureKind, parseAuthFailure } from '../auth-failure';
import { IErrorState, TunnelState, TunnelParameterError } from '../daemon-rpc-types';
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
          message: getMessage(this.context.tunnelState.details, this.context.accountExpiry),
          critical: !!this.context.tunnelState.details.blockFailure,
        }
      : undefined;
  }

  public getInAppNotification(): InAppNotification | undefined {
    return this.context.tunnelState.state === 'error'
      ? {
          indicator:
            this.context.tunnelState.details.cause.reason === 'is_offline' ? 'warning' : 'error',
          title: !this.context.tunnelState.details.blockFailure
            ? messages.pgettext('in-app-notifications', 'BLOCKING INTERNET')
            : messages.pgettext('in-app-notifications', 'NETWORK TRAFFIC MIGHT BE LEAKING'),
          subtitle: getMessage(this.context.tunnelState.details, this.context.accountExpiry),
        }
      : undefined;
  }
}

function getMessage(errorDetails: IErrorState, accountExpiry?: string): string {
  if (errorDetails.blockFailure) {
    if (errorDetails.cause.reason === 'set_firewall_policy_error') {
      switch (process.platform) {
        case 'win32':
          return messages.pgettext(
            'notifications',
            'Unable to block all network traffic. Try disabling any third-party antivirus or security software or contact support.',
          );
        case 'linux':
          return messages.pgettext(
            'notifications',
            'Unable to block all network traffic. Try updating your kernel or contact support.',
          );
      }
    }

    return messages.pgettext(
      'notifications',
      'Unable to block all network traffic. Please troubleshoot or contact support.',
    );
  } else {
    switch (errorDetails.cause.reason) {
      case 'auth_failed': {
        const authFailure = parseAuthFailure(errorDetails.cause.details);
        if (
          authFailure.kind === AuthFailureKind.unknown &&
          accountExpiry &&
          hasExpired(accountExpiry)
        ) {
          return messages.pgettext(
            'auth-failure',
            'You are logged in with an invalid account number. Please log out and try another one.',
          );
        } else {
          return authFailure.message;
        }
      }
      case 'ipv6_unavailable':
        return messages.pgettext(
          'notifications',
          'Could not configure IPv6. Disable it in the app or enable it on your device.',
        );
      case 'set_firewall_policy_error':
        switch (process.platform) {
          case 'win32':
            return messages.pgettext(
              'notifications',
              'Unable to apply firewall rules. Try disabling any third-party antivirus or security software.',
            );
          case 'linux':
            return messages.pgettext(
              'notifications',
              'Unable to apply firewall rules. Try updating your kernel.',
            );
          default:
            return messages.pgettext('notifications', 'Unable to apply firewall rules.');
        }
      case 'set_dns_error':
        return messages.pgettext(
          'notifications',
          'Unable to set system DNS server. Please contact support.',
        );
      case 'start_tunnel_error':
        return messages.pgettext(
          'notifications',
          'Unable to start tunnel connection. Please contact support.',
        );
      case 'tunnel_parameter_error':
        return getTunnelParameterMessage(errorDetails.cause.details);
      case 'is_offline':
        return messages.pgettext(
          'notifications',
          "Your device is offline. Try connecting when it's back online.",
        );
      case 'virtual_adapter_problem':
        return messages.pgettext(
          'notifications',
          'Unable to detect a working virtual adapter on this device. Try enabling it. Otherwise, please reinstall the app.',
        );
    }
  }
}

function getTunnelParameterMessage(err: TunnelParameterError): string {
  switch (err) {
    /// TODO: once bridge constraints can be set, add a more descriptive error message
    case 'no_matching_bridge_relay':
    case 'no_matching_relay':
      return messages.pgettext(
        'notifications',
        "Your selected server and tunnel protocol don't match. Please adjust your settings.",
      );
    case 'no_wireguard_key':
      return messages.pgettext(
        'notifications',
        'Valid WireGuard key is missing. Manage keys under Advanced settings.',
      );
    case 'custom_tunnel_host_resultion_error':
      return messages.pgettext(
        'notifications',
        'Unable to resolve host of custom tunnel. Try changing your settings.',
      );
  }
}
