import React from 'react';
import { Redirect, useParams } from 'react-router-dom';
import { SCHEME_DATA_TAB } from '../workflows/schemeDataWorkflow';

export default function ContractPage() {
  const { draftId } = useParams();
  return <Redirect to={`/ris/penelitian-didanai/${draftId}/pendataan?tab=${SCHEME_DATA_TAB.CONTRACT}`} />;
}
