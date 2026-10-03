const assert = require('assert');
const PizZip = require('pizzip');
const { renderProfileDocx } = require('../../server/services/researcherProfileExportService');

describe('RIS researcher profile Word export', () => {
  it('fills the server template and returns a valid DOCX file', () => {
    const profile = {
      profileId: 'profile-export-test',
      userId: 'user-export-test',
      fullName: 'Dr. Andini Prameswari',
      frontTitle: 'Dr.',
      backTitle: 'M.Kom.',
      nidn: '0123456789',
      institutionEmail: 'andini@example.test',
      faculty: 'Teknik dan Informatika',
      studyProgram: 'Informatika',
      profileStatus: 'active',
      verificationStatus: 'verified',
      profileCompleteness: 100,
      createdAt: '2025-01-01T00:00:00.000Z',
    };
    const account = { id: profile.userId, email: profile.institutionEmail, isActive: true };
    const state = {
      researcherDocuments: [{
        profileId: profile.profileId,
        documentType: 'CV',
        fileName: 'cv-andini.pdf',
        fileFormat: 'PDF',
        fileSize: 1024,
        isActive: true,
      }],
      researcherExpertiseMap: [{ profileId: profile.profileId, expertiseId: 'expertise-ai' }],
      researcherExpertise: [{ expertiseId: 'expertise-ai', name: 'Kecerdasan Buatan' }],
      researcherVerifications: [{
        profileId: profile.profileId,
        verificationStatus: 'verified',
        verificationNotes: 'Data profil telah diperiksa.',
        verifiedAt: '2025-02-01T00:00:00.000Z',
      }],
      adminAssignments: [],
      systemUsers: [],
    };

    const output = renderProfileDocx(profile, account, state);
    const documentXml = new PizZip(output).file('word/document.xml').asText();
    const text = documentXml.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&');

    assert.ok(Buffer.isBuffer(output));
    assert.ok(output.subarray(0, 2).equals(Buffer.from('PK')));
    assert.ok(text.includes('Dr. Andini Prameswari'));
    assert.ok(text.includes('andini@example.test'));
    assert.ok(text.includes('Kecerdasan Buatan'));
    assert.ok(text.includes('cv-andini.pdf'));
    assert.ok(text.includes('Data profil telah diperiksa.'));
    assert.ok(!documentXml.includes('{{'));
  });
});
