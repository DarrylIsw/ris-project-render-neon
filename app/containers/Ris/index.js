/* eslint-disable object-curly-newline, object-property-newline, no-multiple-empty-lines, prefer-destructuring, no-use-before-define, react/prop-types */
import React from 'react';
import PropTypes from 'prop-types';
import { Redirect, Route, Switch } from 'react-router-dom';
import loadable from '../../utils/loadable';
import { RisProvider, useRis } from './core/RisContext';
import Layout from './shared/components/Layout';
import ErrorBoundary from './shared/components/ErrorBoundary';
import { ToastHost } from './shared/components/NotificationCenter';
import NotFoundPage from './shared/components/NotFoundPage';
import {
  canAccessArchive,
  canAccessExternalResearch,
  canAccessLetters,
  canAccessResearchSubmission,
  canAccessSchemeManagement,
  canAssignReviewer,
  canDecideDraft,
  canReviewerViewDraft,
  canScoreDraft,
  canSignContract,
  canVerifyDraft,
  canManageLetters,
  canManageResearch,
  isResearcher,
} from './shared/workflows/workflow';
import { canCreateLetter, canEditLetter, canViewLetter } from './features/letters/workflows/letterWorkflow';
import {
  canAdminReviewExternalReport,
  canArchiveExternalReport,
  canCreateExternalReport,
  canEditExternalReport,
  canViewExternalReport,
} from './features/externalResearch/workflows/externalResearchWorkflow';
import {
  canOpenProfileModule, canViewProfile, canEditProfile, getProfileById, getProfileByUser, isProfileAdmin
} from './features/profiles/workflows/researcherProfileWorkflow';
import { canAccessSchemeData, hasFundedResearch } from './features/research/workflows/schemeDataWorkflow';
import { canScoreFundedReview } from './features/research/workflows/fundedResearchReviewWorkflow';
import './shared/ris.css';

const PageLoading = () => <div className="ris-page-loading" role="status" aria-live="polite"><span />Memuat halaman...</div>;
const page = importer => loadable(importer, { fallback: <PageLoading /> });

const LoginPage = page(() => import('./features/auth/pages/LoginPage'));
const DashboardPage = page(() => import('./features/dashboard/pages/DashboardPage'));
const SchemesPage = page(() => import('./features/research/pages/SchemesPage'));
const SchemeCreatePage = page(() => import('./features/research/pages/SchemeCreatePage'));
const SchemeManagementPage = page(() => import('./features/research/pages/SchemeManagementPage'));
const ProposalWizardPage = page(() => import('./features/research/pages/ProposalWizardPage'));
const ProposalPreviewPage = page(() => import('./features/research/pages/ProposalPreviewPage'));
const ReviewerAssignmentPage = page(() => import('./features/research/pages/ReviewerAssignmentPage'));
const ReviewScoringPage = page(() => import('./features/research/pages/ReviewScoringPage'));
const ContractPage = page(() => import('./features/research/pages/ContractPage'));
const FundedResearchPage = page(() => import('./features/research/pages/FundedResearchPage'));
const SchemeDataPage = page(() => import('./features/research/pages/SchemeDataPage'));
const FundedReviewScoringPage = page(() => import('./features/research/pages/FundedReviewScoringPage'));
const LetterDashboardPage = page(() => import('./features/letters/pages/LetterDashboardPage'));
const LetterWizardPage = page(() => import('./features/letters/pages/LetterWizardPage'));
const LetterCatalogPage = page(() => import('./features/letters/pages/LetterCatalogPage'));
const LetterDetailPage = page(() => import('./features/letters/pages/LetterDetailPage'));
const ExternalResearchDashboardPage = page(() => import('./features/externalResearch/pages/ExternalResearchDashboardPage'));
const ExternalResearchWizardPage = page(() => import('./features/externalResearch/pages/ExternalResearchWizardPage'));
const ExternalResearchDetailPage = page(() => import('./features/externalResearch/pages/ExternalResearchDetailPage'));
const ResearcherProfileDashboardPage = page(() => import('./features/profiles/pages/ResearcherProfileDashboardPage'));
const ResearcherProfileEditorPage = page(() => import('./features/profiles/pages/ResearcherProfileEditorPage'));
const ResearcherProfileDetailPage = page(() => import('./features/profiles/pages/ResearcherProfileDetailPage'));
const ArchivePage = page(() => import('./features/archive/pages/ArchivePage'));

function LoginRoute() {
  const { user } = useRis();
  return user ? <Redirect to="/ris" /> : <LoginPage />;
}

function Unauthorized() {
  return (
    <div className="ris-page">
      <h1>Akses tidak diizinkan</h1>
      <p className="ris-muted">Halaman ini tidak sesuai dengan role, status proposal, atau penugasan akun aktif.</p>
    </div>
  );
}

function ResearchSubmissionLanding() {
  const { data, user } = useRis();
  return hasFundedResearch(data, user)
    ? <Redirect to="/ris/pengajuan-penelitian-internal/daftar-skema" />
    : <SchemesPage />;
}

function GuardedRoute({ component: Component, render, allow, ...rest }) {
  const { data, user } = useRis();
  return (
    <Route
      {...rest}
      render={props => {
        if (!allow({ data, user, props })) return <Unauthorized />;
        if (Component) return <Component {...props} />;
        return render(props);
      }}
    />
  );
}

GuardedRoute.propTypes = {
  component: PropTypes.elementType,
  render: PropTypes.func,
  allow: PropTypes.func.isRequired,
};
GuardedRoute.defaultProps = { component: null, render: null };

const draftFor = (data, props) => data.drafts.find(item => item.id === props.match.params.draftId);
const letterFor = (data, props) => (data.letterRequests || []).find(item => item.id === props.match.params.letterId);
const externalReportFor = (data, props) => (data.externalResearchReports || []).find(item => item.id === props.match.params.reportId);
const researcherProfileFor = (data, props) => getProfileById(data, props.match.params.profileId);

function MyProfilePage(props) {
  const { data, user } = useRis();
  const profile = getProfileByUser(data, user);
  if (profile) return <ResearcherProfileDetailPage {...props} match={{ ...props.match, params: { profileId: profile.profileId } }} />;
  return <ResearcherProfileEditorPage {...props} match={{ ...props.match, params: { profileId: 'me' } }} />;
}

function ProfileModuleLanding(props) {
  const { data, user } = useRis();
  const ownProfile = getProfileByUser(data, user);
  if (!isProfileAdmin(user) && !ownProfile) return <MyProfilePage {...props} />;
  return <ResearcherProfileDashboardPage {...props} />;
}

function ProtectedArea() {
  const { user } = useRis();
  if (!user) return <Redirect to="/login" />;
  return (
    <Layout>
      <Switch>
        <Route exact path="/ris" component={DashboardPage} />
        <GuardedRoute exact path="/ris/pengajuan-penelitian-internal" component={ResearchSubmissionLanding} allow={({ user: activeUser }) => canAccessResearchSubmission(activeUser)} />
        <GuardedRoute exact path="/ris/pengajuan-penelitian-internal/daftar-skema" component={SchemesPage} allow={({ user: activeUser }) => canAccessResearchSubmission(activeUser)} />
        <GuardedRoute exact path="/ris/pengajuan-penelitian-internal/penelitian-didanai" component={FundedResearchPage} allow={({ user: activeUser }) => canAccessResearchSubmission(activeUser)} />
        <GuardedRoute exact path="/ris/penelitian-didanai/:draftId/pendataan" component={SchemeDataPage} allow={({ data, user: activeUser, props }) => canAccessSchemeData(draftFor(data, props), activeUser)} />
        <GuardedRoute exact path="/ris/penelitian-didanai/review/:targetType/:targetId" component={FundedReviewScoringPage} allow={({ data, user: activeUser, props }) => canScoreFundedReview(data, props.match.params.targetType, props.match.params.targetId, activeUser)} />
        <GuardedRoute exact path="/ris/skema" component={SchemeManagementPage} allow={({ user: activeUser }) => canAccessSchemeManagement(activeUser)} />
        <GuardedRoute exact path="/ris/skema/pengajuan" component={SchemeManagementPage} allow={({ user: activeUser }) => canAccessSchemeManagement(activeUser)} />
        <GuardedRoute exact path="/ris/skema/create" component={SchemeCreatePage} allow={({ user: activeUser }) => canAccessSchemeManagement(activeUser)} />
        <GuardedRoute exact path="/ris/pengajuan-penelitian-internal/scheme/:schemeId" component={ProposalWizardPage} allow={({ user: activeUser }) => isResearcher(activeUser) || canManageResearch(activeUser)} />
        <GuardedRoute exact path="/ris/pengajuan-penelitian-internal/:draftId/verifikasi" render={() => <ProposalPreviewPage mode="verify" />} allow={({ data, user: activeUser, props }) => canVerifyDraft(draftFor(data, props), activeUser)} />
        <GuardedRoute exact path="/ris/pengajuan-penelitian-internal/:draftId/reviewer-preview" render={() => <ProposalPreviewPage mode="reviewer" />} allow={({ data, user: activeUser, props }) => canReviewerViewDraft(draftFor(data, props), activeUser)} />
        <GuardedRoute exact path="/ris/pengajuan-penelitian-internal/:draftId/buat-keputusan" render={() => <ProposalPreviewPage mode="decision" />} allow={({ data, user: activeUser, props }) => canDecideDraft(draftFor(data, props), activeUser)} />
        <GuardedRoute exact path="/ris/pengajuan-penelitian-internal/:draftId/pemilihan-reviewer" component={ReviewerAssignmentPage} allow={({ data, user: activeUser, props }) => canAssignReviewer(draftFor(data, props), activeUser)} />
        <GuardedRoute exact path="/ris/pengajuan-penelitian-internal/:draftId/penilaian" component={ReviewScoringPage} allow={({ data, user: activeUser, props }) => canScoreDraft(draftFor(data, props), activeUser)} />
        <GuardedRoute exact path="/ris/pengajuan-penelitian-internal/:draftId/ttd-kontrak" component={ContractPage} allow={({ data, user: activeUser, props }) => canSignContract(draftFor(data, props), activeUser)} />
        <Route exact path="/ris/pengajuan-penelitian-internal/:draftId/preview" render={() => <ProposalPreviewPage mode="preview" />} />
        <GuardedRoute exact path="/ris/pengajuan-surat" component={LetterDashboardPage} allow={({ user: activeUser }) => canAccessLetters(activeUser)} />
        <GuardedRoute exact path="/ris/pengajuan-surat/jenis" component={LetterCatalogPage} allow={({ user: activeUser }) => canManageLetters(activeUser)} />
        <GuardedRoute exact path="/ris/pengajuan-surat/new" component={LetterWizardPage} allow={({ user: activeUser }) => canCreateLetter(activeUser)} />
        <GuardedRoute exact path="/ris/pengajuan-surat/new/:researchId" component={LetterWizardPage} allow={({ user: activeUser }) => canCreateLetter(activeUser)} />
        <GuardedRoute exact path="/ris/pengajuan-surat/:letterId/edit" component={LetterWizardPage} allow={({ data, user: activeUser, props }) => canEditLetter(letterFor(data, props), activeUser)} />
        <GuardedRoute exact path="/ris/pengajuan-surat/:letterId/detail" component={LetterDetailPage} allow={({ data, user: activeUser, props }) => canViewLetter(letterFor(data, props), activeUser)} />
        <GuardedRoute exact path="/ris/pengajuan-surat/:letterId/admin" render={props => <LetterDetailPage {...props} mode="admin" />} allow={({ data, user: activeUser, props }) => canManageLetters(activeUser) && canViewLetter(letterFor(data, props), activeUser)} />
        <GuardedRoute exact path="/ris/penelitian-eksternal" component={ExternalResearchDashboardPage} allow={({ user: activeUser }) => canAccessExternalResearch(activeUser)} />
        <GuardedRoute exact path="/ris/penelitian-eksternal/new" component={ExternalResearchWizardPage} allow={({ user: activeUser }) => canCreateExternalReport(activeUser)} />
        <GuardedRoute exact path="/ris/penelitian-eksternal/:reportId/edit" component={ExternalResearchWizardPage} allow={({ data, user: activeUser, props }) => canEditExternalReport(externalReportFor(data, props), activeUser)} />
        <GuardedRoute exact path="/ris/penelitian-eksternal/:reportId/detail" component={ExternalResearchDetailPage} allow={({ data, user: activeUser, props }) => canViewExternalReport(externalReportFor(data, props), activeUser)} />
        <GuardedRoute exact path="/ris/penelitian-eksternal/:reportId/admin" render={props => <ExternalResearchDetailPage {...props} mode="admin" />} allow={({ data, user: activeUser, props }) => (canAdminReviewExternalReport(externalReportFor(data, props), activeUser) || canArchiveExternalReport(externalReportFor(data, props), activeUser))} />
        <GuardedRoute exact path="/ris/profil-saya" render={props => <MyProfilePage {...props} />} allow={({ user: activeUser }) => Boolean(activeUser)} />
        <GuardedRoute exact path="/ris/profil-peneliti" render={props => <ProfileModuleLanding {...props} />} allow={({ user: activeUser }) => canOpenProfileModule(activeUser)} />
        <GuardedRoute exact path="/ris/profil-peneliti/:profileId/detail" component={ResearcherProfileDetailPage} allow={({ data, user: activeUser, props }) => canViewProfile(researcherProfileFor(data, props), activeUser)} />
        <GuardedRoute exact path="/ris/profil-peneliti/:profileId/edit" component={ResearcherProfileEditorPage} allow={({ data, user: activeUser, props }) => props.match.params.profileId === 'me' || canEditProfile(researcherProfileFor(data, props), activeUser)} />
        <GuardedRoute exact path="/ris/arsip" component={ArchivePage} allow={({ user: activeUser }) => canAccessArchive(activeUser)} />
        <GuardedRoute exact path="/ris/arsip/penelitian/internal/:draftId/edit" render={props => <ProposalWizardPage {...props} archiveMode />} allow={({ user: activeUser }) => canAccessArchive(activeUser)} />
        <GuardedRoute exact path="/ris/arsip/penelitian/external/:reportId/edit" render={props => <ExternalResearchWizardPage {...props} archiveMode />} allow={({ user: activeUser }) => canAccessArchive(activeUser)} />
        <GuardedRoute exact path="/ris/laporan-penelitian" render={() => <Redirect to="/ris/pengajuan-penelitian-internal/penelitian-didanai" />} allow={({ user: activeUser }) => canAccessResearchSubmission(activeUser)} />
        <GuardedRoute exact path="/ris/laporan-luaran" render={() => <Redirect to="/ris/pengajuan-penelitian-internal/penelitian-didanai" />} allow={({ user: activeUser }) => canAccessResearchSubmission(activeUser)} />
        <GuardedRoute exact path="/ris/logbook" render={() => <Redirect to="/ris/pengajuan-penelitian-internal/penelitian-didanai" />} allow={({ user: activeUser }) => canAccessResearchSubmission(activeUser)} />
        <Route render={() => <NotFoundPage insideLayout signedIn />} />
      </Switch>
    </Layout>
  );
}

export default function RisApp() {
  return <ErrorBoundary><RisProvider><><ToastHost /><Switch><Route exact path="/login" component={LoginRoute} /><Route path="/ris" component={ProtectedArea} /><Redirect exact from="/" to="/login" /><Route render={() => <NotFoundPage />} /></Switch></></RisProvider></ErrorBoundary>;
}
