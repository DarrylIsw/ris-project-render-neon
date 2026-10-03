import React from 'react';
import PropTypes from 'prop-types';

export default function NotificationDot({ visible }) {
  if (!visible) return null;
  return <span className="ris-notification-dot" role="img" aria-label="Notifikasi belum dibaca" />;
}

NotificationDot.propTypes = { visible: PropTypes.bool };
NotificationDot.defaultProps = { visible: false };
