# Analisis RIS untuk Presentasi Pengguna dan Tim IT

Tanggal pemeriksaan: 16 September 2026.

Dokumen ini adalah bahan penyusunan PowerPoint, bukan klaim kesiapan produksi. Analisis mencakup jalur aplikasi aktif, konfigurasi, alur domain, skema SQL, backend, dan pengujian. Folder template yang tidak dipakai dibedakan dari implementasi RIS yang aktif. Tidak ada kredensial atau isi .env yang dicantumkan.

**Batas penting:** sebagian besar transaksi bisnis berjalan di browser. PostgreSQL dan backend tersedia sebagai fondasi, tetapi belum menjadi sumber data utama UI. Manfaat organisasi di bawah merupakan kemampuan yang didukung aplikasi, bukan hasil pengukuran efisiensi.

Revisi pengajuan surat terbaru sudah tercakup: admin menerbitkan jenis surat/formulir terlebih dahulu; dosen mengisi langsung tanpa wajib memiliki penelitian didanai. Pengajuan lama tetap kompatibel.

## 1. EXECUTIVE SUMMARY

**Nama aplikasi:** RIS. Nama pada tampilan dan dokumen aplikasi adalah **Research Innovation and Sustainability**, dengan identitas Universitas Multimedia Nusantara. README juga menggunakan Research Information System. Nama resmi dan kepanjangan yang harus dipakai pada presentasi: **NEED BUSINESS CLARIFICATION**.

**Fungsi utama:** memfasilitasi administrasi penelitian dari pengaturan skema, pengajuan proposal, penilaian, keputusan pendanaan, hingga pemantauan pelaksanaan dan pelaporan. Aplikasi juga menangani profil peneliti, pengajuan surat, laporan penelitian eksternal, arsip, dan pemberitahuan.

**Masalah yang tampaknya dituju:** informasi penelitian dan tindakan lanjutan perlu dikelompokkan menurut tahap proses serta tanggung jawab pengguna. Ini disimpulkan dari antrean verifikasi, penugasan penilai, pengaturan tenggat, dan status laporan. Masalah operasional organisasi yang sebenarnya, sistem sebelumnya, dan alasan proyek dimulai: **NEED BUSINESS CLARIFICATION**.

**Target pengguna:** dosen, dosen yang mendapat penugasan penilai, admin sesuai lingkup tugas, manager, dan superadmin.

**Nilai utama:** pengguna dapat mengetahui pekerjaan yang perlu dilakukan, status pengajuan, pihak yang harus bertindak berikutnya, dan dokumen/data terkait dalam satu pengalaman aplikasi.

**Penjelasan 30 detik:**

> RIS membantu dosen dan pengelola menjalankan administrasi penelitian dalam satu alur. Dosen memilih skema, mengajukan proposal, dan memenuhi kewajiban penelitian setelah didanai. Pengelola memverifikasi, menugaskan penilai, mengambil keputusan, serta memantau laporan. Surat dan profil peneliti juga dikelola di tempat yang sama. Saat ini alurnya sudah dapat didemokan; integrasi transaksi backend dan kesiapan produksi masih dikembangkan.

**Kalimat ringkas:**

> RIS adalah platform yang membantu dosen dan pengelola penelitian untuk mengurus pengajuan, penilaian, pendanaan, pelaporan, dan administrasi pendukung sehingga informasi serta tindak lanjut lebih mudah dipantau.

Bukti: [LoginPage.js](../app/containers/Ris/features/auth/pages/LoginPage.js), [Layout.js](../app/containers/Ris/shared/components/Layout.js), [routes frontend](../app/containers/Ris/index.js), [README](../README.md).

## 2. USER & ROLE ANALYSIS

| Role | Siapa user ini | Tujuan penggunaan | Fitur yang bisa diakses | Dashboard/Page utama |
| --- | --- | --- | --- | --- |
| Superadmin | Pengelola berakses menyeluruh dalam aplikasi | Mengelola operasi dan akun | Penelitian, surat, profil, akun, arsip | /ris; halaman manajemen |
| Manager, mode manajemen | Pengelola dengan cakupan lintas fungsi | Mengawasi dan mengambil keputusan | Manajemen penelitian/surat/profil dan arsip; batas tertentu pada akun superadmin | /ris; pemantauan penelitian |
| Manager, mode dosen | Akun manager yang beralih konteks pribadi | Mengurus penelitian dan suratnya sendiri | Pengajuan internal, penelitian didanai, profil pribadi, surat; bukan seluruh kemampuan dosen identik | /ris; daftar skema milik peneliti |
| Admin penelitian | Admin dengan research_management | Menangani penelitian internal/eksternal | Skema, verifikasi, penilai, keputusan, monitoring dan laporan eksternal | /ris; /ris/skema |
| Admin surat | Admin dengan letter_management | Menyiapkan jenis surat dan menerbitkan surat | Katalog jenis surat, formulir/templat, verifikasi, revisi, penerbitan | /ris; /ris/pengajuan-surat |
| Admin profil | Admin dengan researcher_profile_management | Menangani informasi dan pemeriksaan profil | Daftar/verifikasi profil sesuai aturan akun target | /ris; /ris/profil-peneliti |
| Lecturer/dosen | Pemohon dan pelaksana penelitian | Mengajukan dan melaksanakan kegiatan | Profil sendiri, proposal, penelitian didanai, laporan eksternal, surat | /ris; pengajuan internal |
| Dosen dengan penugasan penilai | Dosen yang ditugaskan pada target tertentu | Memberi penilaian proposal/Monev/laporan | Kemampuan dosen ditambah penilaian atas target yang ditugaskan | Tabel tugas penilaian di /ris |

**Jumlah role permanen: empat**, yaitu super_admin, manager, admin, dan lecturer. Tiga jenis admin di tabel adalah lingkup tugas, bukan tiga role permanen tambahan. Penilai adalah penugasan sementara, bukan role login kelima. Student bukan role akun aktif; istilah mahasiswa masih relevan sebagai jenis anggota tim penelitian.

Semua login diarahkan ke **/ris**, lalu isi dasbor dan sidebar ditentukan oleh role, lingkup admin, mode manager, dan penugasan penilai. Manager dapat beralih mode melalui sidebar. Surat boleh diajukan manager dalam mode dosen; pembuatan laporan eksternal saat ini hanya diizinkan untuk role permanen lecturer.

**RBAC frontend tersedia:** helper izin menentukan menu, aksi, dan GuardedRoute. Pemeriksaan pemilik dan penugasan juga ada pada beberapa halaman. Ini belum setara dengan otorisasi server. Backend saat ini belum memverifikasi identitas secara aman.

**Inkonistensi yang perlu diketahui:**

1. Route edit profil memanggil canEditProfile tanpa akun target. Untuk admin profil biasa, pemanggilan tersebut menghasilkan false, sementara halaman detail yang menyertakan akun target menghasilkan true. Tombol edit dapat terlihat tetapi route menolak akses. Dikonfirmasi melalui pengujian fungsi terhadap data demo; belum diubah karena di luar revisi surat.
2. Route laporan internal, luaran, dan logbook lama dialihkan ke penelitian didanai. Bukan dead route, tetapi konteks tab lama tidak selalu dipertahankan.
3. Penilaian penelitian didanai yang sudah dikirim memiliki tombol dasbor Selesai yang nonaktif. Jalur membaca ulang hasil oleh penilai perlu diperjelas.
4. Manager mode dosen tidak boleh disebut identik sepenuhnya dengan lecturer karena pengecualian laporan eksternal.
5. Lingkup admin yang tidak disediakan pada data lama dapat dinormalisasi menjadi semua lingkup. Kebijakan default produksi perlu ditinjau.

Bukti: [workflow.js](../app/containers/Ris/shared/workflows/workflow.js), [researcherProfileWorkflow.js](../app/containers/Ris/features/profiles/workflows/researcherProfileWorkflow.js), [index.js](../app/containers/Ris/index.js), [Layout.js](../app/containers/Ris/shared/components/Layout.js), [RisContext.js](../app/containers/Ris/core/RisContext.js), [DashboardPage.js](../app/containers/Ris/features/dashboard/pages/DashboardPage.js), [externalResearchWorkflow.js](../app/containers/Ris/features/externalResearch/workflows/externalResearchWorkflow.js).

## 3. USER JOURNEY / END-TO-END WORKFLOW

### Workflow A: Login dan pekerjaan pribadi

**Actor:** seluruh role. **Goal:** membuka pekerjaan sesuai akses. **Starting point:** /login.

1. Pengguna memasukkan identitas akun demo.
2. Aplikasi mencocokkan akun dan status aktif dari data browser.
3. Sesi lokal disimpan dan pengguna diarahkan ke /ris.
4. Dasbor menampilkan antrean sesuai role/mode, lalu pengguna membuka tindakan terkait.

**Final outcome:** ruang kerja sesuai konteks pengguna.
**Relevant pages/components:** LoginPage, RisContext, Layout, DashboardPage.
**Relevant API/backend:** belum ada login API aktif.
**Current status:** Partial; dapat didemokan, belum autentikasi produksi.

### Workflow B: Skema sampai keputusan pendanaan

**Actor:** admin penelitian/superadmin/manager, dosen, penilai sementara.
**Goal:** menyeleksi proposal untuk pendanaan. **Starting point:** manajemen penelitian, daftar skema.

1. Pengelola mengatur jadwal, eligibility, maksimum anggaran, pilihan luaran, dan lampiran skema.
2. Dosen membuka skema yang tersedia dan mengisi deskripsi, anggota, anggaran, luaran, dan lampiran; draft dapat disimpan.
3. Pengelola memeriksa kelengkapan melalui tab verifikasi.
4. Satu atau beberapa dosen ditugaskan menjadi penilai dan mengirim skor/catatan.
5. Pengelola mengambil keputusan akhir: didanai, ditolak, atau diminta revisi.

**Final outcome:** proposal memiliki keputusan dan penelitian didanai tersedia untuk tindak lanjut.
**Relevant pages/components:** SchemeCreatePage, SchemesPage, ProposalWizardPage, ResearchMonitoringWorkspace, ReviewScoringPage, ProposalPreviewPage.
**Relevant API/backend:** GET /api/research/schemes dan /api/research/drafts tersedia; transaksi alur ini masih lokal.
**Current status:** Partial; alur frontend tersedia, penyimpanan transaksi SQL belum aktif.

Catatan: aturan saat ini dapat mengizinkan keputusan ketika proposal sudah berstatus reviewed dan ada setidaknya satu review. Jangan mengatakan seluruh penilai wajib selesai sebelum keputusan tanpa konfirmasi aturan organisasi.

### Workflow C: Pelaksanaan penelitian didanai

**Actor:** dosen pemilik penelitian, pengelola penelitian, penilai.
**Goal:** memantau kewajiban dan hasil pelaksanaan. **Starting point:** penelitian didanai.

1. Dosen membuka pendataan penelitian untuk pengumpulan kontrak.
2. Dosen mengirim laporan sementara melalui bagian Monev sesuai periode yang dibuka.
3. Pengelola memasukkan/menerbitkan hasil Monev; dosen tidak mengubah evaluasi pengelola.
4. Pengelola menugaskan penilai pada Monev atau laporan; hasil penilaian dapat dilihat pengelola dan pemilik penelitian.
5. Dosen mengirim laporan akhir dan laporan per luaran pada jadwalnya; pengelola memantau melalui tab agregat.
6. Pengelola dapat memperpanjang/membuka kembali periode. Catatan kegiatan tetap tersedia pada sisi dosen.

**Final outcome:** status kewajiban dan hasil evaluasi tercatat per penelitian.
**Relevant pages/components:** FundedResearchPage, FundedMonitoringSection, SchemeDataPage, ResearchReportPanel, MonevPanel, FundedReviewControls.
**Relevant API/backend:** belum ada API mutasi khusus pelaksanaan yang aktif.
**Current status:** Partial; domain/UI tersedia, penyimpanan file dan transaksi backend belum lengkap.

### Workflow D: Pengajuan surat langsung dari katalog

**Actor:** dosen atau manager mode dosen; admin surat/superadmin/manager mode manajemen.
**Goal:** memperoleh surat penelitian maupun nonpenelitian. **Starting point:** pengajuan surat.

1. Pengelola menerbitkan jenis surat, templat teks, dan isian wajib/opsional melalui Atur Jenis Surat.
2. Dosen memilih jenis surat; keterkaitan penelitian opsional.
3. Dosen mengisi formulir yang langsung muncul, lalu menyimpan draft atau mengajukan.
4. Pengelola memeriksa data, meminta perbaikan, menolak, atau menerbitkan surat.
5. Setelah diterbitkan, dosen mendapat notifikasi web, email masuk antrean opsional, dan dokumen dapat diunduh.

**Final outcome:** surat terbit dan bisa diunduh dalam format TXT saat ini.
**Relevant pages/components:** LetterCatalogPage, LetterWizardPage, LetterDashboardPage, LetterDetailPage, LetterFormFields.
**Relevant API/backend:** GET /api/letters tersedia; email memiliki backend opsional; katalog dan penerbitan masih lokal.
**Current status:** Partial untuk produksi; alur frontend lintas peran sudah diuji sampai unduhan.

Satu pengguna dapat memiliki beberapa surat. Perubahan katalog tidak mengubah salinan formulir pada pengajuan yang sudah dibuat. Alur permintaan awal/form per permintaan hanya dipertahankan untuk kompatibilitas data lama.

### Workflow E: Pelaporan penelitian eksternal

**Actor:** dosen dan pengelola penelitian.
**Goal:** mencatat kegiatan penelitian eksternal/mandiri. **Starting point:** pelaporan penelitian eksternal.

1. Dosen membuat laporan bertahap, termasuk kegiatan, pendanaan, luaran dan dokumen.
2. Laporan disimpan sebagai draft atau diajukan.
3. Pengelola meninjau dan dapat meminta revisi.
4. Laporan yang memenuhi pemeriksaan divalidasi, lalu dapat diarsipkan.

**Final outcome:** laporan eksternal memiliki status pemeriksaan dan rekam data.
**Relevant pages/components:** ExternalResearchWizardPage, ExternalResearchDashboardPage, ExternalResearchDetailPage.
**Relevant API/backend:** GET /api/external-research; mutasi masih lokal.
**Current status:** Partial.

### Workflow F: Profil, akun, dan arsip

**Actor:** pemilik profil, admin profil, manager, superadmin.
**Goal:** memelihara informasi peneliti dan menelusuri rekam kegiatan.
**Starting point:** Profil Saya, manajemen informasi peneliti, atau arsip.

1. Pengguna memperbarui informasi profil dan dokumen terkait.
2. Pengelola yang berwenang memeriksa profil; pengelola akun menentukan role dan lingkup admin.
3. Akun dapat dinonaktifkan sesuai batas kewenangan; perubahan penting menghasilkan notifikasi/email opsional.
4. Manager mode manajemen atau superadmin membuka arsip untuk menelusuri penelitian dan informasi pengguna.

**Final outcome:** profil dan relasi kegiatan bisa ditinjau dari satu ruang kerja.
**Relevant pages/components:** ResearcherProfileDashboardPage, ResearcherProfileDetailPage, ResearcherProfileEditorPage, ArchivePage.
**Relevant API/backend:** GET /api/researcher-profiles; mutasi lokal.
**Current status:** Partial; route edit admin profil memiliki inkonsistensi yang dijelaskan pada bagian 2.

**Pilihan demo utama:** lifecycle penelitian menggunakan rekaman demo yang sudah didanai. Ini paling mewakili tujuan RIS dan memperlihatkan hubungan dosen, pengelola, serta pelaporan tanpa mengisi seluruh proposal saat presentasi. Pengajuan surat baru adalah alternatif demo transaksi pendek yang sudah diuji lintas peran.

Bukti alur: [fitur RIS](../app/containers/Ris/features), [researchMonitoringWorkflow.js](../app/containers/Ris/features/research/workflows/researchMonitoringWorkflow.js), [schemeDataWorkflow.js](../app/containers/Ris/features/research/workflows/schemeDataWorkflow.js), [letterCatalogWorkflow.js](../app/containers/Ris/features/letters/workflows/letterCatalogWorkflow.js), [externalResearchWorkflow.js](../app/containers/Ris/features/externalResearch/workflows/externalResearchWorkflow.js), [archiveWorkflow.js](../app/containers/Ris/features/archive/workflows/archiveWorkflow.js).

## 4. FEATURE INVENTORY

Status menilai implementasi saat ini, bukan sertifikasi produksi. Implemented berarti perilaku tersebut ada pada aplikasi/prototipe; fitur yang memerlukan integrasi lintas perangkat tetap Partial.

| Feature | Business purpose | User/Role | Main page | Backend/API | Status |
| --- | --- | --- | --- | --- | --- |
| Navigasi berbasis role/mode | Memisahkan tanggung jawab | Semua | Sidebar/dasbor | Pemeriksaan frontend | Implemented |
| Katalog skema dan eligibility | Membantu menemukan skema | Dosen, manager mode dosen | SchemesPage | GET research; UI lokal | Partially implemented |
| Pengaturan skema | Mengatur batas dana, luaran, lampiran, jadwal | Pengelola penelitian | SchemeCreatePage | Mutasi belum aktif | Partially implemented |
| Proposal bertahap dan draft | Mengumpulkan data proposal | Peneliti | ProposalWizardPage | Lokal | Partially implemented |
| Verifikasi dan multi-penilai | Memisahkan pemeriksaan dan penilaian | Pengelola, penilai | ResearchMonitoringWorkspace | Lokal | Partially implemented |
| Keputusan pendanaan | Menetapkan hasil seleksi | Pengelola penelitian | Tab Keputusan | Lokal | Partially implemented |
| Monitoring didanai bertab | Membandingkan kewajiban penelitian | Pengelola penelitian | FundedResearchPage | Lokal | Partially implemented |
| Pengumpulan kontrak | Mencatat pengumpulan dokumen | Dosen/pengelola | Pendataan, Kontrak | Metadata lokal | Partially implemented |
| Unduhan templat kontrak | Menyediakan dokumen resmi | Dosen | ContractCollectionPanel | Teks diberi MIME PDF | Placeholder |
| Monev dan penilaian laporan | Mencatat evaluasi pelaksanaan | Pengelola, penilai, dosen | Monev/laporan | Lokal | Partially implemented |
| Laporan sementara/akhir/luaran | Memenuhi kewajiban sesuai jadwal | Dosen/pengelola | Pendataan | Lokal | Partially implemented |
| Perpanjangan jadwal | Membuka kesempatan pengumpulan ulang | Pengelola penelitian | SchemeManagementPage | Lokal | Implemented |
| Catatan kegiatan | Mencatat aktivitas penelitian | Dosen | Pendataan sisi dosen | Lokal | Partially implemented |
| Profil dan kelengkapan | Memelihara informasi peneliti | Semua sesuai akses | Profil Saya/manajemen profil | GET profiles | Partially implemented |
| Edit profil oleh admin terbatas | Memperbaiki profil yang dikelola | Admin profil | Route edit profil | Guard frontend berbeda dari detail | Broken / inconsistent |
| Akun dan lingkup admin | Membagi kewenangan | Superadmin/manager | Editor profil/akun | Lokal | Partially implemented |
| Katalog dan pengajuan surat | Mengurangi pertukaran formulir bolak-balik | Dosen/pengelola surat | Pengajuan Surat | GET letters; mutasi lokal | Partially implemented |
| Surat TXT dan unduhan | Menyampaikan surat terbit | Pemohon/pengelola | Detail/riwayat surat | Generator teks browser | Implemented |
| PDF surat resmi dan tanda tangan terverifikasi | Dokumen resmi | Pemohon/pengelola | Belum terintegrasi pada alur surat | Belum ada layanan lengkap | Placeholder |
| Laporan eksternal/mandiri | Mendata kegiatan di luar hibah internal | Dosen/pengelola | Pelaporan eksternal | GET external-research | Partially implemented |
| Arsip lintas penelitian/profil | Penelusuran rekam kegiatan | Superadmin/manager manajemen | Arsip | Agregasi lokal, SQL views | Partially implemented |
| Notifikasi web | Mengarahkan tindakan berikutnya | Semua sesuai peristiwa | Bell/toast/dialog | Dihitung dari state browser | Implemented |
| Email opsional | Memberi pemberitahuan di luar aplikasi | Penerima peristiwa | Antrean email | SMTP/outbox/retry | Partially implemented |
| Logging/request ID/audit | Membantu diagnosis dan jejak API | Tim IT | Backend | Middleware/service | Partially implemented |
| Integrasi SSO kampus | Identitas institusi | Semua | Tidak ditemukan | Tidak ditemukan | Cannot determine |

### Tujuh fitur untuk ditonjolkan

| Fitur | Masalah dan tindakan pengguna | Nilai yang bisa dijelaskan | Screenshot |
| --- | --- | --- | --- |
| Katalog skema | Dosen perlu membedakan skema yang dapat diikuti dan skema lain | Pilihan serta syarat lebih mudah ditinjau | Daftar Skema, detail kartu |
| Proposal bertahap | Banyak informasi harus dilengkapi secara konsisten | Isian dibagi per bagian dan draft dapat dilanjutkan | Proposal, Anggaran atau Luaran Hasil |
| Verifikasi, penilai, keputusan | Pemeriksaan dan keputusan melibatkan pihak berbeda | Tanggung jawab serta tahapan terlihat | Pemantauan penelitian |
| Monitoring penelitian didanai | Banyak kewajiban tersebar per penelitian | Perbandingan status melalui tab dan filter | Monitoring, Monev/laporan akhir |
| Jadwal laporan | Tenggat dan periode berbeda antar skema | Pengiriman dibatasi jadwal dan bisa dibuka kembali | Jadwal skema/pendataan |
| Surat langsung dari katalog | Pemohon perlu formulir yang jelas sejak awal | Pilih, isi, ajukan, lalu terima hasil | Pengajuan Surat dan Formulir |
| Arsip dan profil | Informasi pengguna serta kegiatan perlu ditelusuri | Rekam terkait dapat dicari kembali | Arsip/detail profil |

Bukti: [routing aktif](../app/containers/Ris/index.js), [Ui.js](../app/containers/Ris/shared/components/Ui.js), [domain workflows](../app/containers/Ris), [routes backend](../server/routes).

## 5. DASHBOARD ANALYSIS

Dasbor utama adalah satu komponen dengan isi kondisional, bukan aplikasi terpisah per role.

| Dashboard | Role | KPI/Information | Key Actions | Data Source | Development Status |
| --- | --- | --- | --- | --- | --- |
| Dasbor pengelolaan penuh | Superadmin/manager manajemen | Jumlah penelitian yang dipantau, antrean surat, laporan eksternal, jumlah/pemeriksaan profil | Verifikasi, atur penilai, putuskan, pantau, proses surat/profil | RisContext, agregasi lokal | Jalur tindakan penelitian punya unit test; bukan analitik DB |
| Dasbor admin penelitian | Admin scope penelitian | Antrean proposal dan eksternal | Verifikasi, penilai, keputusan, pantau, tinjau/arsipkan eksternal | Data lokal difilter scope | Implemented pada prototipe |
| Dasbor admin surat | Admin scope surat | Pengajuan yang perlu diperiksa/diselesaikan | Detail admin/penerbitan; formulir lama jika ada | letterRequests lokal | Alur baru langsung ke verifikasi |
| Dasbor admin profil | Admin scope profil | Kelengkapan dan profil yang perlu diperiksa | Detail/verifikasi profil | researcherProfiles lokal | Route edit perlu perbaikan |
| Dasbor dosen | Dosen/manager mode dosen | Proposal sendiri, surat sendiri, laporan eksternal, kelengkapan profil | Lanjutkan/perbaiki, lihat, TTD kontrak, kelola penelitian | Data milik akun lokal | Implemented; berkas masih terbatas |
| Bagian tugas penilaian | Dosen berpenugasan | Proposal atau target Monev/laporan, tenggat, status kirim | Beri Penilaian/Lihat Penilaian; Selesai untuk tugas tertentu | Assignments/reviews lokal | Baca ulang funded review perlu diperjelas |
| Statistik halaman skema | Peneliti/pengelola | Dibuka, eligible, pengajuan, siap daftar, didanai; statistik pengelola | Filter/kartu/detail/form | Schemes dan drafts | Data demo, bukan angka institusi |
| Statistik pemantauan proposal | Pengelola penelitian | Verifikasi, penilaian dan keputusan per tahap | Filter, checklist, assign, hasil, keputusan | Drafts/reviews | Frontend |
| Statistik penelitian didanai | Pengelola penelitian | Ringkasan dan kewajiban kontrak/Monev/final/luaran per tab | Buka detail pada tab terkait | Jadwal, laporan, kontrak, evaluasi | Frontend; revisi UI sudah tersedia |
| Statistik surat | Pemohon/pengelola | Total, draft, menunggu verifikasi, perlu dilengkapi, diterbitkan | Cari/filter jenis/status, lanjut/hapus draft, unduh | letterRequests | Diuji lintas peran |
| Statistik eksternal | Dosen/pengelola | Total dan status laporan, pendanaan/kategori/luaran | Buat untuk dosen, tinjau/validasi/arsip sesuai izin | externalResearchReports | Frontend |

**Arah tombol utama yang diperiksa:**

| Tombol/konteks | Tujuan aktif |
| --- | --- |
| Buka manajemen penelitian | /ris/skema/pengajuan?stage=preview |
| Verifikasi/Atur Penilai/Putuskan | /ris/skema/pengajuan dengan stage dan focus proposal |
| Pantau penelitian didanai | /ris/penelitian-didanai/:id/pendataan |
| Lanjutkan proposal | /ris/pengajuan-penelitian-internal/scheme/:schemeId |
| TTD Kontrak | Pendataan dengan tab=contract |
| Kelola Penelitian | Pendataan dengan tab=monev |
| Beri Penilaian proposal | /ris/pengajuan-penelitian-internal/:id/penilaian |
| Proses surat | /ris/pengajuan-surat/:id/admin |
| Buat Pengajuan Surat | /ris/pengajuan-surat/new |
| Atur Jenis Surat | /ris/pengajuan-surat/jenis |
| Laporan eksternal | /ris/penelitian-eksternal; detail/admin sesuai status |
| Profil pribadi | /ris/profil-saya |

Angka berasal dari data seed dan perubahan dalam browser, bukan data organisasi live. Tidak ditemukan endpoint dashboard analitik khusus. Hal paling berguna untuk professor adalah **apa yang harus saya lakukan berikutnya**, bukan banyaknya kartu statistik.

Bukti: [DashboardPage.js](../app/containers/Ris/features/dashboard/pages/DashboardPage.js), [dashboardWorkflow.js](../app/containers/Ris/features/dashboard/workflows/dashboardWorkflow.js), [dashboard tests](../test/ris/dashboard-workflow.test.js), [FundedMonitoringSection.js](../app/containers/Ris/features/research/components/FundedMonitoringSection.js), [LetterDashboardPage.js](../app/containers/Ris/features/letters/pages/LetterDashboardPage.js).

## 6. BUSINESS PROCESS YANG DAPAT DISIMPULKAN

CURRENT / INTENDED PROCESS:

~~~text
Pengelola menerbitkan skema
  -> Dosen memilih dan mengajukan proposal
  -> Sistem memeriksa kelengkapan dasar dan batas anggaran
  -> Pengelola memverifikasi
  -> Dosen yang ditugaskan menilai
  -> Pengelola memutuskan pendanaan
  -> Dosen memenuhi kontrak dan kewajiban laporan
  -> Pengelola/penilai mengevaluasi dan memantau
  -> Rekam penelitian dapat ditelusuri di arsip

Proses pendukung:
Pengelola menerbitkan jenis surat -> Dosen mengisi -> Verifikasi -> Surat terbit
Dosen memperbarui profil -> Pemeriksaan pengelola
Dosen melaporkan penelitian eksternal -> Pemeriksaan -> Validasi/arsip
~~~

1. **Didigitalisasi:** pengisian proposal, pembagian tugas penilai, pencatatan keputusan, jadwal laporan, pencatatan evaluasi, surat, dan profil.
2. **Proses sebelum RIS:** tidak dapat dibuktikan dari repository. Penggunaan kertas, spreadsheet, email atau sistem lain sebelumnya adalah **NEED BUSINESS CLARIFICATION**, bukan fakta yang boleh diasumsikan.
3. **Terpusat pada UI:** data proposal, pelaksanaan, profil dan tindakan. Sentralisasi database multiuser nyata belum selesai.
4. **Keputusan dibantu:** pemeriksaan kelengkapan, pemilihan penilai, keputusan akhir manusia, pemantauan keterlambatan, revisi atau penerbitan surat.
5. **Manfaat didukung:** pencarian status, pengelompokan pekerjaan sesuai akses, riwayat tindakan, validasi input, dan pembuatan notifikasi berdasarkan perubahan status. Penghematan jam kerja, penurunan kesalahan, serta ROI belum diukur.

Bukti: [workflow.js](../app/containers/Ris/shared/workflows/workflow.js), [reportingWorkflow.js](../app/containers/Ris/features/research/workflows/reportingWorkflow.js), [researchMonitoringWorkflow.js](../app/containers/Ris/features/research/workflows/researchMonitoringWorkflow.js), [notificationWorkflow.js](../app/containers/Ris/shared/workflows/notificationWorkflow.js).

## 7. FRONTEND ARCHITECTURE

| Bagian | Implementasi yang ditemukan |
| --- | --- |
| Framework | React 18.2.0 |
| Routing | React Router DOM 5.x; lazy loading halaman melalui helper loadable |
| State bisnis | React Context, useState/useEffect, helper domain |
| State template | Redux, redux-saga dan redux-persist masih ada di pembungkus aplikasi; bukan store utama transaksi RIS |
| UI aktif | Komponen lokal Ui.js, Icon.js dan ris.css |
| UI template | Dependency MUI/Emotion/react-jss serta struktur style template masih tersedia |
| Form | Controlled React inputs dan validasi JavaScript domain; tidak mengasumsikan Formik/Joi |
| API | Helper fetch/API terpisah dan gateway email; transaksi utama belum memakai API |
| Autentikasi | Pencocokan akun demo dan sesi localStorage dalam RisContext |
| Otorisasi | Helper role/scope/ownership/assignment dan route guard |
| Build | Webpack 5, Babel, pemrosesan CSS/SCSS |

~~~text
Pengguna
  -> Browser
     -> React + Router
        -> Halaman RIS + komponen bersama
        -> RisContext + fungsi domain
           -> dataGateway -> localStorage (data bisnis aktif)
           -> emailDeliveryGateway -> Express (opsional)

Fondasi API pembacaan -> Express -> PostgreSQL
(bukan alur mutasi utama UI saat ini)
~~~

Struktur utama: app/containers/Ris/features memisahkan dashboard, penelitian, surat, pelaporan eksternal, profil, arsip, dan autentikasi; shared dan core menampung kebutuhan lintas fitur. app/containers/App dan app/app.js menjembatani root template. app/redux dan app/styles mempertahankan infrastruktur template.

Koreksi penting terhadap beberapa deskripsi lama README: ikon aktif adalah komponen SVG lokal, pengujian Mocha, logging JSON khusus, dan validasi domain JavaScript. Jangan menyebut Lucide, Jest/RTL, Pino atau Joi sebagai teknologi aktif hanya berdasarkan README.

Bukti: [package.json](../package.json), [app.js](../app/app.js), [App/index.js](../app/containers/App/index.js), [RisContext.js](../app/containers/Ris/core/RisContext.js), [dataGateway.js](../app/containers/Ris/core/dataGateway.js), [Ui.js](../app/containers/Ris/shared/components/Ui.js), [Icon.js](../app/containers/Ris/shared/components/Icon.js), [actions.js](../app/containers/Ris/core/actions.js).

## 8. BACKEND ARCHITECTURE

Backend menggunakan **Node.js dan Express**, dengan API bergaya REST.

~~~text
index.js
  -> server/index.js
     -> middleware request context/logging/auth placeholder
     -> routes -> controllers -> models -> pg Pool -> PostgreSQL
     -> email/audit services
     -> middleware frontend (development atau production)
~~~

- Routes memetakan endpoint; controllers mengatur respons/error; models berisi SQL.
- Library pg digunakan langsung, bukan ORM.
- Identitas request sementara diambil dari header x-user-id dan x-user-role. requireUser hanya memeriksa keberadaan identitas tersebut.
- Endpoint domain aktif umumnya membaca daftar data. Production mutation reference masih berupa komentar, bukan controller transaksi aktif.
- Layanan email memakai Nodemailer, antrean, retry, dan worker interval dalam proses Node yang sama.
- Belum ditemukan layanan upload/storage berkas bisnis yang menyimpan dan menyajikan seluruh file secara permanen.
- Notifikasi web utama dibentuk dari perubahan state frontend; tidak ditemukan push server/WebSocket untuk notifikasi tersebut.
- Audit trail API dan pelacakan error tersedia sebagai fondasi. Error tracking eksternal belum terhubung.
- Penjadwalan pengingat domain sebagian berasal dari timer browser; worker server mengirim antrean email yang sudah ada.

Bukti: [server/index.js](../server/index.js), [routes](../server/routes/index.js), [models](../server/models), [auth.js](../server/middlewares/auth.js), [emailDeliveryService.js](../server/services/emailDeliveryService.js), [productionMutationRoutes.reference.js](../docs/reference/productionMutationRoutes.reference.js).

## 9. DATABASE & DATA MODEL

Database yang dituju: **PostgreSQL**, diakses melalui pg. Root database.sql memuat 76 tabel setelah penambahan katalog surat. Tabel banyak karena data bisnis, relasi, riwayat, dokumen dan notifikasi dipisahkan; presentasi tidak perlu menampilkan semuanya.

| Kelompok entitas penting | Tabel/contoh | Hubungan dan fungsi |
| --- | --- | --- |
| 1. Identitas dan izin | users, roles, user_admin_scopes | Akun memiliki role dan scope |
| 2. Informasi peneliti | researcher_profiles dan tabel dokumen/keahlian/verifikasi | Profil terkait akun |
| 3. Skema | schemes, reporting_periods, output_options, attachment_requirements | Skema menentukan aturan proposal/laporan |
| 4. Proposal | research_drafts, draft_projects, members, budget_items, outputs, files | Banyak proposal terkait satu skema/pemilik |
| 5. Pemeriksaan dan keputusan | proposal_verifications, reviewer_assignments, submission_reviews, proposal_decisions | Proposal memiliki pemeriksaan, banyak penilai dan keputusan |
| 6. Pelaksanaan didanai | funded_research, research_contracts, research_reports, research_monev | Penelitian terkait kontrak dan kewajiban |
| 7. Evaluasi/catatan kegiatan | funded_review_assignments, funded_reviews, research_logbooks | Penugasan per target dan kegiatan per penelitian |
| 8. Surat | letter_definitions, letter_requests, letter_request_templates/fields/values, generated_letters | Katalog dapat dipakai banyak surat; research_id opsional |
| 9. Penelitian eksternal | external_research beserta output/file/review/history | Laporan terkait pengguna dan peninjauan |
| 10. Operasional | stored_files, notifications, email_outbox, system_activity_logs | Metadata berkas, pemberitahuan, pengiriman dan audit |

Beberapa nama di kolom tabel merupakan nama kelompok singkat; lihat SQL untuk nama lengkap setiap tabel.

~~~text
Role -> User -> Admin scopes
          |
          +-> Researcher profile -> Documents / Expertise
          +-> Proposal -> Scheme -> Reporting periods / Output options
          |      +-> Verification / Reviewer assignments / Reviews / Decision
          |      +-> Funded research
          |             +-> Contract / Monev / Reports / Outputs / Logbooks
          |             +-> Funded review assignments -> Reviews
          +-> Letter requests <- Letter definitions
          |      +-> Template/field copy -> Values -> Issued letter
          +-> External research -> Outputs / Files / Reviews
          +-> Notifications / Email outbox
~~~

Secara sederhana, akun mengajukan kegiatan; skema memberi aturan; pengelola dan penilai mencatat hasil; penelitian didanai memiliki kewajiban; surat dan profil menjadi data pendukung.

**Batas migrasi:** data frontend berbentuk objek bersarang dan ID string demo, sedangkan SQL menggunakan UUID serta tabel relasional. Perlu pemetaan, endpoint mutasi, validasi, dan transaksi; tidak cukup mengganti konfigurasi koneksi database.

**SQL bootstrap bersifat destruktif:** terdapat DROP SCHEMA public CASCADE. Ada seed demo aktif dan alternatif seed deployment yang dikomentari. Jangan menjalankannya untuk memperbarui database berisi data nyata tanpa strategi migrasi dan backup.

Bukti: [database.sql](../database.sql), [data.js](../app/containers/Ris/core/data.js), [db.js](../server/config/db.js), [letterCatalogWorkflow.js](../app/containers/Ris/features/letters/workflows/letterCatalogWorkflow.js).

## 10. API & DATA FLOW

| API Group | Purpose | Main consumer | Important operations |
| --- | --- | --- | --- |
| Health | Mengecek server/koneksi DB | Tim IT | GET status kesehatan |
| Research | Membaca skema/proposal | Fondasi integrasi frontend | GET schemes dan drafts |
| Letters | Membaca pengajuan beserta data terkait | Fondasi integrasi surat | GET daftar surat; belum CRUD katalog/penerbitan |
| External research | Membaca laporan eksternal | Fondasi integrasi pelaporan | GET daftar laporan |
| Researcher profiles | Membaca profil | Fondasi integrasi profil | GET daftar profil |
| Email | Mengecek kemampuan kirim dan menerima antrean | emailDeliveryGateway | GET status, POST outbox |
| Authentication/accounts | Login dan administrasi akun produksi | Belum terintegrasi | Tidak ditemukan endpoint aktif yang menyelesaikan kebutuhan ini |
| Production mutations | Rancangan transaksi masa depan | Reference files | Komentar, bukan endpoint yang dapat dipakai |

**Contoh transaksi bisnis yang benar-benar aktif:**

~~~text
Dosen menekan Ajukan Surat
  -> React memvalidasi isian sesuai templat yang dipilih
  -> saveCatalogLetter memperbarui status
  -> RisContext membentuk notifikasi dan antrean email
  -> dataGateway menyimpan agregat ke localStorage
  -> UI menampilkan menunggu verifikasi
~~~

Tidak ada request SQL dalam langkah penyimpanan surat di atas.

**Cabang email opsional yang memang memakai backend:**

~~~text
Perubahan antrean email di browser
  -> Gateway mengecek kesiapan email
  -> Jika aktif, POST batch outbox dengan header identitas sementara
  -> Middleware memeriksa keberadaan identitas, bukan autentikasi kuat
  -> Controller/service memvalidasi payload dan mencegah duplikasi
  -> Outbox PostgreSQL, atau memori bila DB tidak dikonfigurasi
  -> Worker mengirim melalui SMTP atau menjadwalkan retry
~~~

Jika email tidak siap, transaksi utama tetap berjalan. Untuk produksi, pembentukan event/outbox harus menjadi bagian transaksi server, bukan bergantung pada browser.

Bukti: [routes](../server/routes/index.js), [controllers](../server/controllers), [RisContext.js](../app/containers/Ris/core/RisContext.js), [letterCatalogWorkflow.js](../app/containers/Ris/features/letters/workflows/letterCatalogWorkflow.js), [emailDeliveryGateway.js](../app/containers/Ris/shared/workflows/emailDeliveryGateway.js), [emailOutboxModel.js](../server/models/emailOutboxModel.js).

## 11. AUTHENTICATION & SECURITY

### Currently implemented

- Login demo mencocokkan akun dan password pada data browser, lalu menyimpan sesi di localStorage. Tidak ditemukan login server/JWT/OAuth/cookie session yang menjadi sumber identitas aktif.
- Frontend memeriksa role, scope, pemilik dan penugasan; akun tidak aktif ditolak saat login.
- SQL memiliki password_hash dan seed menggunakan pgcrypto/bcrypt. Ini **tidak berarti login frontend telah memakai hash database**.
- Backend membaca x-user-id/x-user-role yang dapat ditentukan klien; requireUser bukan verifikasi identitas produksi.
- Routes pembacaan domain belum semuanya memakai pemeriksaan akses akun/record.
- Validasi bisnis dan berkas terdapat di frontend. Ukuran/ekstensi file bukan pengganti validasi server.
- Ada parameter SQL pada operasi tertentu, redaksi beberapa atribut sensitif di audit, dan escaping pada templat email.
- CORS eksplisit tidak ditemukan pada jalur server aktif; frontend/backend umumnya satu origin.
- Belum ditemukan proteksi terintegrasi berupa rate limiting login, session expiry server, cookie aman, ataupun CSRF untuk rancangan sesi produksi.

### Potential improvement

1. Terapkan autentikasi server, password hashing saat pembuatan akun, sesi aman, logout/revocation dan masa berlaku.
2. Verifikasi izin serta kepemilikan setiap request di backend; jangan mempercayai role dari header.
3. Batasi endpoint email pada event bisnis/penerima yang sah, disertai rate limit dan audit. Jangan membuka relay email umum sebelum autentikasi kuat.
4. Validasi ulang input, file dan perubahan status dalam transaksi server.
5. Gunakan penyimpanan file privat, otorisasi unduhan dan pemindaian file sesuai kebutuhan.
6. Siapkan kebijakan akses data pribadi, retensi, backup, dan penghapusan.

Ini adalah kebutuhan sebelum sistem dipublikasikan dengan data nyata, bukan bukti pernah terjadi kebocoran.

Bukti: [RisContext.js](../app/containers/Ris/core/RisContext.js), [auth.js](../server/middlewares/auth.js), [routes](../server/routes), [fileValidation.js](../app/containers/Ris/shared/workflows/fileValidation.js), [auditTrailService.js](../server/services/auditTrailService.js), [emailTemplateService.js](../server/services/emailTemplateService.js), [database.sql](../database.sql).

## 12. INTEGRATION / EXTERNAL SERVICES

| Service | Purpose | Communication | Status |
| --- | --- | --- | --- |
| PostgreSQL | Basis data relasional | pg Pool | Model dan skema ada; mutasi UI belum terhubung |
| SMTP/Nodemailer | Email pemberitahuan | Worker server ke SMTP | Opsional, perlu konfigurasi valid; pengiriman nyata tidak diuji |
| Notifikasi dalam aplikasi | Informasi status/tindak lanjut | State browser | Aktif pada prototipe; bukan push lintas perangkat |
| Dokumen rujukan TKT/RIP | Referensi pengisian | Tautan eksternal | Link, bukan integrasi pertukaran data |
| jsPDF | Dokumen pendanaan tertentu | Generator browser | Ada; bukan generator universal seluruh surat/kontrak |
| SSO kampus/OAuth | Identitas institusi | Tidak ditemukan | Cannot determine |
| Cloud storage/Firebase | Penyimpanan terkelola | Tidak ditemukan pada alur aktif | Belum terintegrasi |
| AI/ML, pembayaran, analytics eksternal | Layanan tambahan | Tidak ditemukan pada alur aktif | Jangan diklaim sebagai fitur |
| Sentry/error tracker eksternal | Pemantauan error terpusat | Adapter logging lokal | Fondasi saja |
| Sistem kampus lain | Sinkronisasi dosen/penelitian | Tidak ditemukan konektor aktif | NEED BUSINESS CLARIFICATION |

Contoh nama konfigurasi email yang tersedia: EMAIL_ENABLED, APP_BASE_URL, EMAIL_FROM, SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD. Nama bukan nilai kredensial. Konfigurasi nonproduksi juga menyediakan pengalihan atau pembatasan penerima.

Bukti: [email config](../server/config/email.js), [emailDeliveryService.js](../server/services/emailDeliveryService.js), [fundingLetterPdf.js](../app/containers/Ris/features/research/workflows/fundingLetterPdf.js), [errorTracker.js](../server/observability/errorTracker.js), [ProposalWizardPage.js](../app/containers/Ris/features/research/pages/ProposalWizardPage.js).

## 13. DEPLOYMENT / INFRASTRUCTURE

| Aspek | Yang ditemukan |
| --- | --- |
| Development | npm start menjalankan Node/Express dengan middleware webpack |
| Build | npm run build menghasilkan bundle produksi |
| Production runtime | npm run start:prod menjalankan Express yang menyajikan build dan API |
| Service aplikasi | Satu proses aplikasi Node dapat melayani frontend dan API; PostgreSQL terpisah; SMTP eksternal opsional |
| Port | Default server 3001, dapat diatur konfigurasi |
| Komunikasi frontend/backend | Umumnya same-origin /api |
| DB | pg Pool dengan konfigurasi koneksi dan opsi SSL |
| Docker | Dockerfile/compose untuk deployment aplikasi tidak ditemukan |
| Reverse proxy | app/.nginx.conf dan .htaccess berupa contoh/template |
| TLS | Contoh konfigurasi HTTPS ada, bukan bukti sertifikat atau deployment aktif |
| CI | GitHub Actions menjalankan npm ci, npm test, npm run build pada Node 18 |
| CD | Tidak ditemukan job otomatis deployment |
| Environment | Development dan production eksplisit; staging belum jelas |

~~~text
Browser
  -> [Reverse proxy / HTTPS: perlu konfigurasi deployment]
     -> Node + Express
        +-> Static React build
        +-> /api -> PostgreSQL
        +-> Email worker -> SMTP opsional

Saat prototipe: browser juga menyimpan data utama di localStorage.
~~~

Konfigurasi nginx contoh memiliki domain/path sertifikat contoh dan bagian proxy API yang dikomentari; port contoh proxy perlu diselaraskan dengan server. Jangan langsung menyatakannya siap untuk hosting.

Versi engine minimum di package metadata dan Node 18 pada CI perlu diselaraskan dengan runtime deployment yang dipilih. Vendor hosting, kapasitas, domain, strategi backup, dan target SLA: **NEED BUSINESS CLARIFICATION**.

Bukti: [package.json](../package.json), [index.js](../index.js), [server/index.js](../server/index.js), [frontendMiddleware.js](../server/middlewares/frontendMiddleware.js), [nginx template](../app/.nginx.conf), [CI](../.github/workflows/quality.yml).

## 14. CURRENT DEVELOPMENT STATUS

### Completed, dalam batas prototipe

- Navigasi berbasis role/scope/mode, katalog skema, form proposal bertahap dan helper keputusan.
- UI pemantauan proposal dan penelitian didanai, termasuk pemisahan laporan sementara ke Monev dan final ke laporan akhir.
- Katalog surat, pengajuan langsung, draft, revisi, penerbitan TXT, unduhan dan notifikasi.
- Pengaturan jadwal/perpanjangan, profil, laporan eksternal, dan agregasi arsip.
- Unit test aturan domain serta pipeline lint/build.

Bukti: [halaman aktif](../app/containers/Ris/index.js), [test/ris](../test/ris), [letter catalog tests](../test/ris/letter-catalog-workflow.test.js).

### In Progress

- Integrasi mutasi dan otorisasi backend untuk data bisnis.
- Penyimpanan/unduhan berkas permanen.
- Email operasional lintas pengguna dengan konfigurasi nyata.
- Audit dan reminder yang sepenuhnya berjalan di server.
- Penyelarasan model bersarang frontend dengan SQL relasional.

Bukti: [dataGateway.js](../app/containers/Ris/core/dataGateway.js), [productionDataApi.reference.js](../docs/reference/productionDataApi.reference.js), [productionMutationRoutes.reference.js](../docs/reference/productionMutationRoutes.reference.js).

### Placeholder / Mock

- Akun dan data penelitian demo dari data.js.
- Unduhan kontrak berupa teks dengan MIME application/pdf, bukan PDF yang dibentuk secara benar.
- Surat akhir pada alur surat masih TXT.
- Penanda tanda tangan pada PDF pendanaan bukan bukti tanda tangan digital bersertifikat.
- Banyak upload disimpan sebagai metadata nama/ukuran/tipe; sebagian foto/templat memakai data URL. Tidak semua dokumen tersimpan sebagai file backend.
- File reference produksi berupa komentar; tidak bisa dijanjikan siap hanya dengan uncomment.

Bukti: [data.js](../app/containers/Ris/core/data.js), [ContractCollectionPanel.js](../app/containers/Ris/features/research/components/ContractCollectionPanel.js), [LetterDetailPage.js](../app/containers/Ris/features/letters/pages/LetterDetailPage.js), [fundingLetterPdf.js](../app/containers/Ris/features/research/workflows/fundingLetterPdf.js).

### Potentially Broken / Inconsistent

| Temuan | Dasar | Implikasi |
| --- | --- | --- |
| Admin profil dapat melihat aksi edit tetapi route menolak | index.js tidak meneruskan targetAccount ke canEditProfile | Perlu menyamakan pemeriksaan izin |
| Banyak proposal satu skema tidak identik dengan banyak proposal satu dosen | Wizard mencari proposal pertama dengan pasangan schemeId/userId dan membatasi pengajuan aktif | Kebijakan pengajuan berulang perlu dipastikan dan diuji |
| Keputusan dapat diproses setelah minimal satu review | canDecideDraft dan hasSubmittedReview | Konfirmasi apakah seluruh penilai wajib selesai |
| Kontrak unduhan bukan PDF valid | Blob berisi teks biasa | Hindari demo membuka kontrak sebagai dokumen resmi |
| Route lama laporan mengarah ke daftar didanai | Redirect pada index.js | Tautan lama bisa kehilangan konteks tab |
| Beberapa deskripsi README tidak sesuai dependency aktif | Perbandingan kode dan package.json | Gunakan kode sebagai sumber materi teknis |
| Data browser bukan data lintas perangkat | dataGateway/RisContext | Jangan menjanjikan kolaborasi real-time multiuser |

Tidak semua berkas lama berarti rusak. Halaman template dan beberapa halaman laporan lama tidak berada pada routing RIS aktif; keduanya perlu dipisahkan dari fitur yang benar-benar dapat diakses.

### Planned / Cannot Determine

SSO, PDF surat resmi, e-signature, penyimpanan cloud, kebijakan akses produksi, integrasi sistem kampus, serta tanggal go-live belum dapat dipastikan dari repository.

### Hasil verifikasi pada sesi revisi surat

- 106 unit test lulus.
- Lint seluruh cakupan RIS/backend/test lulus; perubahan akhir surat juga diperiksa dengan lint terarah.
- Dua build produksi berhasil, termasuk build terakhir setelah perapian UI.
- Uji browser lintas peran: publikasi katalog, isian wajib, tanpa penelitian, simpan/muat ulang draft, revisi, submit ulang, penerbitan, unduhan, notifikasi dan mode manager berhasil tanpa page error.
- Desktop/mobile diperiksa, termasuk teks kartu agar tidak keluar batas.
- SQL baru belum dieksekusi pada PostgreSQL; email SMTP nyata tidak dikirim dalam pengujian.

Ini bukan klaim seluruh skenario aplikasi atau keamanan produksi telah diuji.

## 15. DEMO READINESS

### Recommended Demo Scenario

**Peran utama:** dosen, lalu pengelola penelitian. **Halaman awal:** /ris setelah login dosen.

1. Tunjukkan dasbor dosen dan perbedaan pekerjaan sendiri dengan tugas penilaian.
2. Buka daftar skema: eligible, katalog, draft, serta detail satu skema.
3. Buka proposal tersimpan untuk menunjukkan lima bagian, batas anggaran, pilihan luaran dan lampiran; tidak perlu mengirim proposal baru.
4. Buka penelitian yang sudah didanai dan pendataannya.
5. Tunjukkan Monev/laporan sementara serta laporan akhir/luaran sesuai jadwal, tanpa membuka PDF kontrak demo.
6. Logout lalu login pengelola dalam browser yang sama; buka monitoring didanai bertab dan detail penelitian yang sama.
7. Tutup dengan status evaluasi dan arsip, sambil menjelaskan bahwa keputusan akhir tetap pada pengelola.

~~~text
Dasbor -> Pilih skema -> Proposal -> Penelitian didanai
       -> Kewajiban laporan -> Monitoring pengelola -> Rekam terpadu
~~~

**Alternatif demo transaksi singkat yang sudah diuji:** Atur Jenis Surat -> dosen pilih surat nonpenelitian -> isi dan ajukan -> pengelola terbitkan -> dosen menerima notifikasi dan mengunduh TXT.

**Sebelum presentasi:**

- Gunakan profil browser khusus demo. Data lokal dapat berubah akibat demonstrasi.
- Gunakan browser yang sama ketika berganti role agar melihat dataset yang sama; bukan perangkat berbeda.
- Siapkan data demo pada tahapan yang diperlukan, dokumen contoh aman, dan tanggal periode laporan yang sesuai.
- Pastikan dev server berjalan. Untuk alur lokal, database/SMTP tidak wajib aktif.
- Jangan reset data demo pada browser yang berisi pekerjaan yang masih diperlukan.
- Siapkan screenshot cadangan.

**Hindari:** klaim login aman/SSO, email sungguhan tanpa konfigurasi, membuka kontrak dummy sebagai PDF resmi, upload seolah file sudah tersimpan permanen, edit profil admin terbatas yang terkena guard mismatch, atau menyebut hasil demo sebagai statistik institusi.

Bukti: [data.js](../app/containers/Ris/core/data.js), [dataGateway.js](../app/containers/Ris/core/dataGateway.js), [DashboardPage.js](../app/containers/Ris/features/dashboard/pages/DashboardPage.js), [FundedResearchPage.js](../app/containers/Ris/features/research/pages/FundedResearchPage.js).

## 16. PRESENTATION SCREENSHOT RECOMMENDATIONS

| Priority | Page | Why show it | Business message |
| --- | --- | --- | --- |
| 1 | Dasbor dosen | Menggambarkan titik masuk pekerjaan | Pengguna mengetahui tindakan berikutnya |
| 2 | Katalog skema dan detail | Menjelaskan pilihan dan eligibility | Skema tersedia dalam katalog yang mudah ditinjau |
| 3 | Proposal, bagian anggaran atau luaran | Memperlihatkan struktur dan batas input | Persyaratan skema terhubung dengan pengajuan |
| 4 | Pemantauan proposal, tab penilai/keputusan | Memperlihatkan pembagian tanggung jawab | Penilaian terpisah dari keputusan pendanaan |
| 5 | Monitoring didanai, Monev atau laporan akhir | Memperlihatkan pelaksanaan setelah pendanaan | Penelitian tidak berhenti pada persetujuan proposal |
| 6 | Pendataan penelitian dari sisi dosen | Menunjukkan kewajiban individual | Dosen melihat laporan dan periode terkait |
| 7 | Pengajuan surat baru, katalog/formulir | Memperlihatkan revisi alur yang lebih singkat | Surat dapat diajukan tanpa penelitian didanai |
| 8 | Arsip/detail profil terkait | Merangkum hubungan data | Rekam kegiatan dan peneliti dapat ditelusuri |

Gunakan data demo, hilangkan informasi pribadi nyata, dan jangan menampilkan layar konfigurasi kredensial. Satu screenshot harus membawa satu pesan, bukan seluruh halaman panjang.

## 17. TECHNICAL SLIDE MATERIAL

### Slide: System Architecture

~~~text
Dosen / Penilai / Admin / Manager / Superadmin
                         |
                    Browser React
                    /           \
        Data lokal prototipe     HTTP /api
                                   |
                              Node + Express
                              /            \
                         PostgreSQL      SMTP opsional
                         (fondasi)       (antrean/retry)

Target berikutnya:
Transaksi bisnis, identitas, file, dan pengingat menjadi tanggung jawab server.
~~~

Actors dan frontend aktif; backend dan SQL tersedia; **jangan menggambar seluruh mutasi sudah melewati DB**. Infrastruktur target berupa Node service, PostgreSQL, HTTPS/reverse proxy terkonfigurasi dan SMTP opsional.

### Slide: Technology Stack

| Layer | Technology | Responsibility |
| --- | --- | --- |
| UI | React 18, CSS/komponen lokal | Halaman, formulir, tabel dan interaksi |
| Navigation | React Router 5 | Routing dan pengelompokan halaman |
| Prototype state | React Context + localStorage | State bisnis demonstrasi |
| Backend | Node.js + Express 4 | API, middleware, penyajian aplikasi |
| Data | PostgreSQL + pg | Model relasional dan akses SQL |
| Email | Nodemailer + outbox | Pengiriman opsional dan retry |
| Tooling | Webpack 5 + Babel | Build frontend |
| Quality | Mocha/Node assert + ESLint + GitHub Actions | Pengujian aturan, lint, build |

Bukti: [package.json](../package.json), [RisContext.js](../app/containers/Ris/core/RisContext.js), [server](../server/index.js), [database.sql](../database.sql), [CI](../.github/workflows/quality.yml).

## 18. RISKS / LIMITATIONS

### Product / UX

Kebijakan jumlah proposal per dosen/skema, syarat penyelesaian semua penilai, rubrik Monev, dan kewenangan final perlu pengesahan bisnis. Guard edit profil dan jalur membaca ulang hasil penilaian juga perlu dirapikan. Data surat lama masih menunjukkan status alur terdahulu demi kompatibilitas.

### Technical

Penyimpanan agregat localStorage mempunyai batas kapasitas dan belum menyediakan transaksi multiuser, penguncian, konflik edit, atau sinkronisasi lintas perangkat. Timer browser tidak menjamin seluruh pengingat terbentuk saat tidak ada pengguna membuka aplikasi.

### Security

Login dan role browser adalah mekanisme prototipe. Header identitas backend belum tepercaya; akses record dan endpoint email perlu dilindungi sebelum dibuka ke publik. Data demo tidak boleh dijadikan mekanisme login produksi.

### Data

Data contoh bukan sumber resmi. Metadata upload tidak sama dengan berkas tersimpan. Migrasi UUID, relasi SQL dan salinan formulir perlu kontrak data yang jelas. SQL bootstrap destruktif bukan migration script untuk database produksi yang sudah berjalan.

### Deployment

Belum ada bukti deployment produksi, backup/restore teruji, observabilitas terpusat, load test, ataupun TLS operasional. Build masih menggunakan dependency/tooling template yang menampilkan peringatan deprecation.

### Development completeness

CRUD bisnis backend, autentikasi, file storage, PDF resmi, dan pengiriman email nyata belum diverifikasi end-to-end. Fondasi tersedia, tetapi kode reference komentar masih membutuhkan implementasi dan pengujian.

Bukti: [dataGateway.js](../app/containers/Ris/core/dataGateway.js), [auth.js](../server/middlewares/auth.js), [emailNotificationWorkflow.js](../app/containers/Ris/shared/workflows/emailNotificationWorkflow.js), [database.sql](../database.sql), [ContractCollectionPanel.js](../app/containers/Ris/features/research/components/ContractCollectionPanel.js).

## 19. QUESTIONS PROFESSOR MIGHT ASK

| Pertanyaan | Suggested factual answer |
| --- | --- |
| 1. Untuk apa RIS dibuat? | Mendukung alur administrasi penelitian dan data pendukung. Masalah organisasi spesifik perlu NEED BUSINESS CLARIFICATION. |
| 2. Siapa yang menggunakan? | Dosen, dosen berpenugasan penilai, admin dengan lingkup tugas, manager dan superadmin. |
| 3. Apa bedanya dengan proses sekarang? | RIS menawarkan alur status dan antrean terpadu. Perbandingan dengan proses institusi saat ini perlu NEED BUSINESS CLARIFICATION. |
| 4. Apakah dosen melihat semua skema? | Katalog dapat menampilkan skema, tetapi kemampuan mendaftar dibatasi eligibility dan periode. |
| 5. Apa yang terjadi setelah proposal dikirim? | Pengelola memverifikasi, menugaskan penilai, lalu mengambil keputusan akhir. |
| 6. Apakah penilai langsung menyetujui pendanaan? | Tidak. Review menjadi masukan; keputusan akhir ada pada pengelola yang berwenang. |
| 7. Setelah didanai, apa yang harus dilakukan? | Pengumpulan kontrak dan kewajiban laporan sesuai jadwal/luaran, dengan pemantauan pengelola. |
| 8. Siapa mengisi hasil Monev? | Evaluasi Monev diberikan pengelola; dosen dapat melihatnya. Laporan sementara dari dosen berada pada bagian Monev. |
| 9. Apakah terlambat berarti tidak bisa mengumpulkan selamanya? | Pengelola dapat memperpanjang atau membuka kembali periode sesuai kewenangan. |
| 10. Apakah surat wajib terkait penelitian? | Tidak pada alur baru. Pilih jenis surat yang diterbitkan admin, isi formulir, lalu ajukan. |
| 11. Bagaimana saya tahu surat selesai? | Ada notifikasi web dan tautan unduh; email opsional jika sudah dikonfigurasi. |
| 12. Apakah data sudah data kampus sebenarnya? | Dataset saat ini untuk demo dan perubahan tersimpan lokal di browser. |
| 13. Apakah sudah siap digunakan resmi? | Belum. Alur dapat didemokan, tetapi integrasi transaksi, keamanan dan dokumen produksi belum selesai. |
| 14. Berapa banyak waktu yang dihemat? | Belum ada hasil pengukuran. Target dan baseline efisiensi perlu NEED BUSINESS CLARIFICATION. |

Dasar jawaban: bagian 2 sampai 6, 14 dan 18, beserta sumber kode di masing-masing bagian.

## 20. QUESTIONS IT TEAM MIGHT ASK

| Pertanyaan | Jawaban faktual |
| --- | --- |
| 1. Apakah frontend dan backend berbeda service? | Dapat dilayani satu Express process, dengan React build dan /api pada origin yang sama. |
| 2. Apa sumber data UI sekarang? | RisContext dan localStorage melalui dataGateway; bukan DB untuk seluruh operasi. |
| 3. Apakah mengganti DATABASE_URL cukup? | Tidak. Perlu API mutasi, mapping model, auth, transaksi, file storage dan pengujian. |
| 4. Apakah menggunakan ORM? | Tidak; pg dan query SQL langsung. |
| 5. Bagaimana autentikasinya? | Login demo di browser; middleware server baru membaca header identitas sementara. |
| 6. Bagaimana RBAC? | Helper frontend role/scope/mode/owner/assignment; backend harus menerapkan pemeriksaan independen. |
| 7. Apakah password di-hash? | Skema/seed SQL menggunakan hash; login demo frontend bukan autentikasi hash server. |
| 8. Bagaimana penilai dimodelkan? | Penugasan sementara per proposal/target, bukan role akun permanen. |
| 9. Apakah surat bergantung pada funded_research? | Tidak; penelitian terkait opsional. Katalog/formulir tersimpan per jenis dan disalin ke pengajuan. |
| 10. Apa yang terjadi jika SMTP mati? | Fitur utama tetap berjalan. Pengiriman opsional dapat tidak aktif atau melakukan retry; layanan nyata belum diuji. |
| 11. Apakah pengingat tetap berjalan tanpa browser? | Worker mengirim antrean di server, tetapi pembentukan sebagian pengingat masih bergantung browser. |
| 12. Bagaimana file disimpan? | Banyak operasi masih metadata lokal; sebagian inline data URL. Belum ada storage bisnis lengkap. |
| 13. Apakah ada audit? | Ada jejak lokal dan middleware/service audit API, tetapi mutasi lokal belum menjadi audit server tepercaya. |
| 14. Bagaimana menangani error? | ErrorBoundary frontend, middleware error server, request ID/logging dan containment email. |
| 15. Apakah SQL aman dijalankan untuk upgrade? | Tidak langsung; bootstrap menghapus skema. Susun migration non-destruktif untuk database existing. |
| 16. Apa pengujiannya? | Mocha/Node assert, ESLint, build; browser flow surat diuji di desktop/mobile. Bukan audit keamanan/load test. |
| 17. Apakah sudah scalable? | Belum ada bukti kapasitas. Pool DB tersedia, tetapi state lokal, file, queue dan transaksi perlu desain produksi. |
| 18. Apa CI/CD-nya? | GitHub Actions untuk install/test/build; deployment otomatis belum ditemukan. |

Dasar jawaban: [server](../server), [RisContext.js](../app/containers/Ris/core/RisContext.js), [database.sql](../database.sql), [test/ris](../test/ris), [CI](../.github/workflows/quality.yml).

## 21. INFORMATION YOU CANNOT DETERMINE

### NEED BUSINESS CLARIFICATION

1. Apa nama dan kepanjangan resmi RIS untuk materi presentasi?
2. Siapa pemilik proses, sponsor proyek, dan pihak yang menyetujui penerapan?
3. Masalah operasional apa yang menjadi alasan utama pembangunan?
4. Bagaimana proses sebelum RIS dan sistem apa yang sudah dipakai?
5. Apa KPI keberhasilan, baseline, dan target waktu/akurasi yang diharapkan?
6. Berapa jumlah akun, penelitian, dokumen, dan pengguna bersamaan?
7. Apakah satu dosen boleh mengajukan beberapa proposal pada skema/periode yang sama?
8. Apakah semua penilai wajib selesai sebelum keputusan final, dan bagaimana konflik penilaian ditangani?
9. Siapa berhak mengambil keputusan pada setiap jenis pendanaan?
10. Apa rubrik resmi, bobot, ambang nilai dan bentuk hasil Monev/laporan?
11. Apa aturan keterlambatan, perpanjangan, penolakan dan revisi laporan?
12. Apa jenis surat resmi, format nomor, kop, penandatangan dan dasar hukumnya?
13. Apakah membutuhkan tanda tangan digital tersertifikasi atau pengesahan dokumen bentuk lain?
14. Siapa yang mengesahkan perubahan templat/formulir surat dan kapan versi baru berlaku?
15. Apakah identitas berasal dari SSO kampus atau akun lokal?
16. Sistem kampus mana yang perlu disinkronkan dan siapa pemilik API/datanya?
17. Bagaimana kebijakan retensi, klasifikasi data pribadi, akses arsip dan penghapusan?
18. Hosting, domain, penyedia email/storage dan penanggung jawab operasionalnya siapa?
19. Target go-live, kelompok pilot, UAT, dan kriteria penerimaan seperti apa?
20. Apa RTO/RPO, backup, restore, SLA dan prosedur eskalasi gangguan?
21. Roadmap mana yang sudah disetujui organisasi dan mana yang masih usulan?

## 22. FINAL PRESENTATION SUMMARY

Rekomendasi 12 slide. Utamakan cerita pengguna; rincian teknis cukup dua slide.

### Slide 1: Konteks dan Kebutuhan

**Purpose:** mengawali dari kebutuhan, bukan teknologi.
**Main message:** administrasi penelitian melibatkan banyak tahap dan pihak.
**Content:** tahapan pengajuan, evaluasi, pelaksanaan, pelaporan; konteks masalah asli diisi setelah klarifikasi.
**Suggested visual:** diagram proses singkat, bukan daftar dependency.
**Source/code evidence:** workflow.js, ResearchMonitoringWorkspace.js, SchemeDataPage.js.

### Slide 2: Siapa Penggunanya

**Purpose:** memperjelas sasaran dan tanggung jawab.
**Main message:** tampilan dan tindakan mengikuti peran.
**Content:** dosen, penilai sementara, admin berscope, manager, superadmin.
**Suggested visual:** lima kelompok aktor; penilai diberi label penugasan dosen.
**Source/code evidence:** workflow.js, Layout.js, RisContext.js.

### Slide 3: RIS sebagai Solusi

**Purpose:** memperkenalkan aplikasi.
**Main message:** satu pengalaman kerja untuk proses penelitian dan administrasi pendukung.
**Content:** penelitian internal, pelaksanaan/laporan, profil, surat, eksternal, arsip.
**Suggested visual:** screenshot dasbor dengan tiga penanda fungsi.
**Source/code evidence:** DashboardPage.js, index.js.

### Slide 4: Alur dari Skema sampai Pendanaan

**Purpose:** menjelaskan alur utama.
**Main message:** pengajuan, verifikasi, penilaian dan keputusan merupakan tahap berbeda.
**Content:** buat skema -> proposal -> verifikasi -> penilai -> keputusan pengelola.
**Suggested visual:** diagram lima tahap dengan aktor di bawahnya.
**Source/code evidence:** SchemeCreatePage.js, ProposalWizardPage.js, researchMonitoringWorkflow.js.

### Slide 5: Pengalaman Dosen

**Purpose:** memperlihatkan manfaat konkret bagi pemohon.
**Main message:** persyaratan skema diterjemahkan menjadi formulir terstruktur.
**Content:** katalog eligible, draft, batas anggaran, pilihan luaran, lampiran.
**Suggested visual:** katalog skema dan potongan Luaran Hasil.
**Source/code evidence:** SchemesPage.js, ProposalWizardPage.js, schemeConfiguration.js.

### Slide 6: Setelah Penelitian Didanai

**Purpose:** menunjukkan sistem tidak berhenti pada persetujuan.
**Main message:** kewajiban dan evaluasi pelaksanaan dapat dipantau.
**Content:** kontrak, Monev/laporan sementara, laporan akhir, laporan luaran, pengaturan periode.
**Suggested visual:** monitoring didanai bertab dan satu detail laporan.
**Source/code evidence:** FundedResearchPage.js, FundedMonitoringSection.js, ResearchReportPanel.js.

### Slide 7: Administrasi Pendukung

**Purpose:** menjelaskan fitur sehari-hari di luar proposal.
**Main message:** surat dan informasi peneliti mengikuti kebutuhan pengguna.
**Content:** alur surat pilih-isi-ajukan, profil, arsip, notifikasi.
**Suggested visual:** formulir surat baru dan badge status; tegaskan penelitian tidak wajib terkait.
**Source/code evidence:** LetterCatalogPage.js, LetterWizardPage.js, ArchivePage.js, NotificationCenter.js.

### Slide 8: Demonstrasi Singkat

**Purpose:** membuktikan interaksi, bukan hanya screenshot.
**Main message:** setiap tindakan membawa pengguna ke tahap berikutnya.
**Content:** skenario maksimal tujuh langkah pada bagian 15; surat sebagai alternatif pendek.
**Suggested visual:** live demo, dengan screenshot cadangan.
**Source/code evidence:** DashboardPage.js, dashboardWorkflow.js, letter-catalog-workflow.test.js.

### Slide 9: Arsitektur Sistem

**Purpose:** memberi konteks kepada tim IT tanpa membebani pengguna.
**Main message:** UI dan fondasi backend ada; transaksi utama masih prototipe lokal.
**Content:** browser React, localStorage aktif, Express, PostgreSQL, SMTP opsional.
**Suggested visual:** diagram pada bagian 17 dengan garis yang membedakan kondisi kini dan target.
**Source/code evidence:** RisContext.js, dataGateway.js, server/index.js, database.sql.

### Slide 10: Teknologi dan Kualitas

**Purpose:** menjelaskan dasar pemeliharaan.
**Main message:** teknologi dipisahkan menurut tanggung jawab, dan ada pengujian.
**Content:** React, Node/Express, PostgreSQL/pg, Mocha/ESLint, CI; batas autentikasi/file/dokumen.
**Suggested visual:** tabel ringkas stack dan tiga cek kualitas.
**Source/code evidence:** package.json, test/ris, .github/workflows/quality.yml.

### Slide 11: Progress dan Batas Saat Ini

**Purpose:** menghindari kesan aplikasi sudah production-ready.
**Main message:** alur demonstrasi tersedia; integrasi produksi masih dikerjakan.
**Content:** tersedia: workflow/UI/notifikasi; berikutnya: transaksi DB, autentikasi, file, dokumen resmi, email nyata.
**Suggested visual:** dua kolom Sudah Dapat Didemokan dan Belum Siap Produksi.
**Source/code evidence:** bagian 14 dan sumbernya.

### Slide 12: Langkah Berikutnya dan Masukan

**Purpose:** mengakhiri dengan keputusan yang dibutuhkan.
**Main message:** validasi proses bisnis mendahului penerapan produksi.
**Content:** sahkan aturan/rubrik/templat; bangun transaksi dan auth server; storage/PDF; UAT, keamanan, deployment.
**Suggested visual:** roadmap berurutan tanpa tanggal yang belum disetujui.
**Source/code evidence:** productionDataApi.reference.js, productionMutationRoutes.reference.js; kebijakan/tanggal adalah NEED BUSINESS CLARIFICATION.

### THE 5 MOST IMPORTANT THINGS I SHOULD EXPLAIN TO THE PROFESSOR

1. RIS mengikuti siklus penelitian dari skema sampai kewajiban setelah didanai.
2. Dosen, penilai, dan pengelola mempunyai tindakan serta tanggung jawab berbeda.
3. Dasbor dan status membantu menemukan pekerjaan berikutnya.
4. Surat, profil dan arsip melengkapi administrasi; surat baru tidak wajib terkait penelitian.
5. Ini sistem yang masih dikembangkan dengan data demo, bukan layanan produksi yang sudah disahkan.

### THE 5 MOST IMPORTANT TECHNICAL THINGS I SHOULD BE READY TO ANSWER

1. Sumber data UI saat ini adalah state/browser; migrasi ke DB memerlukan transaksi dan mapping, bukan sekadar koneksi.
2. Otorisasi frontend sudah ada, tetapi autentikasi dan otorisasi backend produksi belum selesai.
3. Express dapat melayani React dan API dalam satu service; PostgreSQL dan SMTP merupakan dependensi terpisah.
4. Berkas, PDF resmi, pengingat server dan pengiriman email nyata masih memiliki batas implementasi.
5. Unit test, lint dan build tersedia, tetapi belum menggantikan UAT, pengujian keamanan, backup/restore dan load test.
