/* eslint-disable object-curly-newline, react/prop-types */
import React from 'react';
import { useHistory } from 'react-router-dom';
import { useRis } from '../../../core/RisContext';
import { letterRequestGateway } from '../../../core/dataGateway';
import { Button, Field, FloatingError, PageBack, StatusBadge } from '../../../shared/components/Ui';
import LetterFormFields from '../components/LetterFormFields';
import { uid } from '../../../core/data';
import { getFundedResearches } from '../../research/workflows/schemeDataWorkflow';
import { canEditLetter, getLetterTitle, letterStatusMeta } from '../workflows/letterWorkflow';
import { createCatalogLetterDraft, getPublishedLetterDefinitions, saveCatalogLetter } from '../workflows/letterCatalogWorkflow';

export default function LetterWizardPage({ match }) {
  const { data, setData, runServerMutation, showToast, user } = useRis();
  const history = useHistory();
  const stored = (data.letterRequests || []).find(item => item.id === match.params.letterId);
  const [draft, setDraft] = React.useState(() => stored || null);
  const [researchId, setResearchId] = React.useState(match.params.researchId || '');
  const [error, setError] = React.useState('');
  const definitions = getPublishedLetterDefinitions(data);
  const researches = getFundedResearches(data, user);

  React.useEffect(() => {
    setDraft(stored || null);
    setError('');
  }, [match.params.letterId]);

  const selectDefinition = definitionId => {
    if (draft && Object.values(draft.form || {}).some(value => String(value).trim()) && !window.confirm('Ganti jenis surat dan kosongkan isian yang belum disimpan?')) return;
    try {
      setDraft(createCatalogLetterDraft({ definitionId, researchId }, user, data, uid));
      setError('');
    } catch (err) { setError(err.message); }
  };

  const save = async submit => {
    try {
      if (submit) {
        const saved = await runServerMutation(() => letterRequestGateway.submit({
          definitionId: draft.definitionId,
          researchId: draft.researchId || null,
          form: draft.form || {},
          ...(user.managerMode ? { managerMode: user.managerMode } : {}),
        }));
        history.push(`/ris/pengajuan-surat/${saved.letterId}/detail`);
        return;
      }
      setData(current => saveCatalogLetter(current, draft, user, false));
      if (!submit) showToast({ tone: 'success', title: 'Draft tersimpan', message: 'Pengajuan dapat dilanjutkan dari riwayat surat.' });
      history.push('/ris/pengajuan-surat');
    } catch (err) { setError(err.message); }
  };

  const changeResearch = value => {
    try {
      if (draft) {
        const updated = createCatalogLetterDraft({ definitionId: draft.definitionId, researchId: value }, user, data, uid);
        setDraft(current => ({ ...current, researchId: updated.researchId, autoFill: updated.autoFill }));
      }
      setResearchId(value);
    } catch (err) { setError(err.message); }
  };

  if (match.params.letterId && !stored) return <div className="ris-page"><h1>Pengajuan tidak ditemukan</h1><PageBack onClick={() => history.push('/ris/pengajuan-surat')} /></div>;
  const meta = draft && letterStatusMeta(draft);
  const revision = stored && (stored.history || []).slice(-1)[0];
  return <div className="ris-page ris-workspace-page ris-letter-page">
    <PageBack onClick={() => history.push('/ris/pengajuan-surat')} />
    <div className="ris-page-heading"><div><h1>{stored ? getLetterTitle(stored) : 'Pengajuan Surat Baru'}</h1></div>{meta && <StatusBadge tone={meta.tone}>{meta.label}</StatusBadge>}</div>
    <FloatingError message={error} />
    {stored && stored.status === 'revision_required' && revision && <div className="ris-alert ris-alert-warning"><strong>Catatan Perbaikan</strong><p>{revision.note}</p></div>}
    {!stored && <section className="ris-section-spaced">
      <h2>Jenis Surat</h2>
      <Field label="Penelitian Terkait (Opsional)"><select value={researchId} onChange={event => changeResearch(event.target.value)}><option value="">Tidak terkait penelitian</option>{researches.map(item => <option key={item.id} value={item.id}>{item.project && item.project.title}</option>)}</select></Field>
      <div className="ris-letter-kind-grid" role="group" aria-label="Jenis surat">
        {definitions.map(item => <button key={item.id} type="button" className={`ris-letter-kind ${draft && draft.definitionId === item.id ? 'is-selected' : ''}`} aria-pressed={Boolean(draft && draft.definitionId === item.id)} onClick={() => selectDefinition(item.id)}><strong>{item.name}</strong><span>{item.description}</span><small>{item.fields.length} isian</small></button>)}
      </div>
      {!definitions.length && <div className="ris-empty-state">Belum ada jenis surat yang diterbitkan oleh pengelola.</div>}
    </section>}
    {draft && <>
      <section className="ris-section-spaced"><div className="ris-form-section-heading"><h2>Identitas Pemohon</h2></div><dl className="ris-letter-research-summary"><div><dt>Nama</dt><dd>{draft.applicant.name}</dd></div><div><dt>Email</dt><dd>{draft.applicant.email}</dd></div><div><dt>Program Studi</dt><dd>{draft.applicant.program}</dd></div></dl></section>
      <section className="ris-section-spaced"><div className="ris-form-section-heading"><h2>Data Surat</h2></div><LetterFormFields fields={draft.templateFields || []} values={draft.form || {}} onChange={(key, value) => setDraft(current => ({ ...current, form: { ...current.form, [key]: value } }))} /></section>
      <div className="ris-bottom-bar"><div>{getLetterTitle(draft)}</div><div><Button tone="gray" onClick={() => history.push('/ris/pengajuan-surat')}>Kembali</Button>{canEditLetter(stored || draft, user) && <><Button tone="blue" onClick={() => save(false)}>Simpan Draft</Button><Button tone="green" onClick={() => save(true)}>Ajukan Surat</Button></>}</div></div>
    </>}
  </div>;
}
