export const canTransition = (transitions, currentStatus, nextStatus) => {
  if (!currentStatus || !nextStatus) return false;
  if (currentStatus === nextStatus) return true;
  return (transitions[currentStatus] || []).includes(nextStatus);
};

export const transitionEntity = ({
  entity, currentStatus, nextStatus, transitions, statusFields, changes = {}
}) => {
  if (!entity || !canTransition(transitions, currentStatus, nextStatus)) return null;
  return statusFields.reduce((next, field) => ({ ...next, [field]: nextStatus }), { ...entity, ...changes });
};
