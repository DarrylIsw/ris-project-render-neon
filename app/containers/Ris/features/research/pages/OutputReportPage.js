import React from 'react';
import InternalResearchReportPage from './InternalResearchReportPage';
import { REPORT_TYPE } from '../workflows/reportingWorkflow';

export default function OutputReportPage() {
  return <InternalResearchReportPage initialType={REPORT_TYPE.OUTPUT} />;
}
