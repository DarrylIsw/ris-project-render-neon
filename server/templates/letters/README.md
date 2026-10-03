# Paket Template Surat RIS - Universitas Multimedia Nusantara (UMN)

## Integrasi aplikasi

Lokasi paket sekarang adalah `server/templates/letters`, bukan direktori root.
`shared/letterDocumentTemplates.js` memetakan 21 file ke kategori/subkategori RIS.
`server/services/letterDocumentService.js` mengisi placeholder DOCX dengan
Docxtemplater lalu mengonversinya ke PDF memakai LibreOffice. Instal LibreOffice
di server; `LIBREOFFICE_PATH` dapat menunjuk executable-nya.

Form builder menyimpan `template.sourceId` (A01 sampai E01) dan `template.values`
untuk `letterPlace`, `letterDate`, `signerName`, `signerTitle`, serta isi surat
kustom `customContent`. Key isian yang sesuai placeholder akan mengisi lokasi
aslinya; isian lain yang terisi ditambahkan sebagai Informasi Tambahan sebelum
penutup/tanda tangan. Token kosong tidak ditampilkan dan baris data opsional
yang kosong dihapus. Nama/jabatan penandatangan wajib sebelum membuat PDF draf.
Isian kustom diperlakukan sebagai data, bukan kode atau XML.

Pratinjau adalah PDF asli dengan layout yang sama dengan hasil unduhan.
Admin mengunduh draf, menandatangani di luar RIS, mengunggah PDF bertanda tangan,
lalu menerbitkannya. Dosen hanya mendapatkan PDF final tersebut. Sistem tidak
membuat tanda tangan otomatis. Riwayat surat lama tidak dihapus.

Paket ini berisi **21 template DOCX terpisah** untuk sistem Research, Innovation, and Sustainability (RIS) UMN. File Word adalah **templat sumber**; dokumen final yang ditujukan kepada dosen/pemohon sebaiknya dihasilkan sebagai PDF oleh aplikasi setelah seluruh placeholder diganti.

## Catatan desain dan integrasi

- Logo UMN pada setiap template memakai aset resmi yang diberikan. Area RIS ditandai `[LOGO RESMI RIS]` karena aset logo RIS tidak disertakan; admin perlu mengganti/menghapus penanda ini sebelum produksi final.
- Tata letak mengikuti gaya surat formal UMN: logo di bagian atas, judul terpusat, isi berstruktur, dan blok tanda tangan. Tidak ada nama pejabat, alamat, nomor telepon, tanda tangan, stempel, dasar hukum, atau nomor surat permanen yang diarang.
- Placeholder ditulis literal dengan format `{{variableName}}` dan sengaja dibuat sebagai teks biasa agar mudah diproses template engine. Saat integrasi, pastikan penggantian placeholder mempertahankan format DOCX dan menghapus placeholder opsional yang tidak memiliki nilai.
- Karena integrasi DOCX -> pengisian data -> PDF belum dibuktikan tersedia pada aplikasi, lakukan uji integrasi terlebih dahulu. Jika engine melakukan replacement berbasis run/paragraf, pertahankan placeholder sebagai token utuh.
- Field tipe `pilihan` memakai opsi rekomendasi; admin boleh menyesuaikan opsi sesuai data master aplikasi tanpa mengubah key variabel yang sudah dipakai template.

## Kategori sistem

| Kategori | Fungsi |
|---|---|
| `research_assignment` | Surat Tugas Penelitian dan Inovasi |
| `support` | Surat Pendukung Kegiatan |
| `ethics` | Klirens Etik Riset |
| `travel` | Surat Tugas Perjalanan Dinas |
| `custom` | Surat Custom tanpa kepentingan baku |

## Placeholder umum dan sumber data

Data pemohon dan penelitian seperti `{{applicantName}}`, `{{applicantIdentifier}}`, `{{applicantEmail}}`, `{{applicantRole}}`, `{{studyProgram}}`, `{{faculty}}`, `{{researchTitle}}`, `{{researchYear}}`, `{{researchDuration}}`, `{{researchLocation}}`, `{{researchScheme}}`, `{{researchRole}}`, dan `{{researchTeam}}` dapat dipetakan dari data aplikasi bila tersedia. Placeholder lain seperti penerima, mitra, detail kegiatan, nomor/tanggal surat, dan penandatangan dipetakan dari form/admin atau konfigurasi sistem sesuai kebutuhan template.

## Daftar template dan field form builder

### A01_Surat_Tugas_Penelitian_Mandiri.docx

- **Kategori:** `research_assignment`
- **Kepentingan:** Penelitian Mandiri
- **Placeholder yang digunakan:** `{{applicantIdentifier}}`, `{{applicantName}}`, `{{applicantRole}}`, `{{faculty}}`, `{{letterDate}}`, `{{letterNumber}}`, `{{letterPlace}}`, `{{researchDuration}}`, `{{researchLocation}}`, `{{researchRole}}`, `{{researchScheme}}`, `{{researchTeam}}`, `{{researchTitle}}`, `{{researchYear}}`, `{{signerName}}`, `{{signerTitle}}`, `{{studyProgram}}`
- **Field tambahan yang direkomendasikan untuk form admin:**

| Label | Key | Tipe | Wajib | Opsi |
|---|---|---|---|---|
| Tempat penerbitan surat | `{{letterPlace}}` | teks | Ya | - |

### A02_Surat_Tugas_Penelitian_Kerja_Sama_PT_Dalam_Negeri.docx

- **Kategori:** `research_assignment`
- **Kepentingan:** Penelitian Kerja Sama Perguruan Tinggi Dalam Negeri
- **Placeholder yang digunakan:** `{{applicantIdentifier}}`, `{{applicantName}}`, `{{applicantRole}}`, `{{faculty}}`, `{{letterDate}}`, `{{letterNumber}}`, `{{letterPlace}}`, `{{partnerInstitution}}`, `{{partnerName}}`, `{{researchDuration}}`, `{{researchLocation}}`, `{{researchRole}}`, `{{researchScheme}}`, `{{researchTeam}}`, `{{researchTitle}}`, `{{researchYear}}`, `{{signerName}}`, `{{signerTitle}}`, `{{studyProgram}}`
- **Field tambahan yang direkomendasikan untuk form admin:**

| Label | Key | Tipe | Wajib | Opsi |
|---|---|---|---|---|
| Nama mitra | `{{partnerName}}` | teks | Tidak | - |
| Institusi mitra | `{{partnerInstitution}}` | teks | Tidak | - |
| Tempat penerbitan surat | `{{letterPlace}}` | teks | Ya | - |

### A03_Surat_Tugas_Penelitian_Kerja_Sama_PT_Luar_Negeri.docx

- **Kategori:** `research_assignment`
- **Kepentingan:** Penelitian Kerja Sama Perguruan Tinggi Luar Negeri
- **Placeholder yang digunakan:** `{{applicantIdentifier}}`, `{{applicantName}}`, `{{applicantRole}}`, `{{faculty}}`, `{{letterDate}}`, `{{letterNumber}}`, `{{letterPlace}}`, `{{partnerCountry}}`, `{{partnerInstitution}}`, `{{partnerName}}`, `{{researchDuration}}`, `{{researchLocation}}`, `{{researchRole}}`, `{{researchScheme}}`, `{{researchTeam}}`, `{{researchTitle}}`, `{{researchYear}}`, `{{signerName}}`, `{{signerTitle}}`, `{{studyProgram}}`
- **Field tambahan yang direkomendasikan untuk form admin:**

| Label | Key | Tipe | Wajib | Opsi |
|---|---|---|---|---|
| Nama mitra | `{{partnerName}}` | teks | Tidak | - |
| Institusi mitra | `{{partnerInstitution}}` | teks | Tidak | - |
| Negara mitra | `{{partnerCountry}}` | teks | Ya | - |
| Tempat penerbitan surat | `{{letterPlace}}` | teks | Ya | - |

### A04_Surat_Tugas_Penelitian_Hibah_Internal.docx

- **Kategori:** `research_assignment`
- **Kepentingan:** Penelitian Hibah Internal
- **Placeholder yang digunakan:** `{{applicantIdentifier}}`, `{{applicantName}}`, `{{applicantRole}}`, `{{faculty}}`, `{{letterDate}}`, `{{letterNumber}}`, `{{letterPlace}}`, `{{programName}}`, `{{programUrl}}`, `{{researchDuration}}`, `{{researchLocation}}`, `{{researchRole}}`, `{{researchScheme}}`, `{{researchTeam}}`, `{{researchTitle}}`, `{{researchYear}}`, `{{signerName}}`, `{{signerTitle}}`, `{{studyProgram}}`
- **Field tambahan yang direkomendasikan untuk form admin:**

| Label | Key | Tipe | Wajib | Opsi |
|---|---|---|---|---|
| Nama program/hibah | `{{programName}}` | teks | Ya | - |
| Tautan program/hibah | `{{programUrl}}` | teks | Tidak | - |
| Tempat penerbitan surat | `{{letterPlace}}` | teks | Ya | - |

### A05_Surat_Tugas_Penelitian_Pemerintah.docx

- **Kategori:** `research_assignment`
- **Kepentingan:** Penelitian Pemerintah
- **Placeholder yang digunakan:** `{{applicantIdentifier}}`, `{{applicantName}}`, `{{applicantRole}}`, `{{faculty}}`, `{{letterDate}}`, `{{letterNumber}}`, `{{letterPlace}}`, `{{programName}}`, `{{programUrl}}`, `{{researchDuration}}`, `{{researchLocation}}`, `{{researchRole}}`, `{{researchScheme}}`, `{{researchTeam}}`, `{{researchTitle}}`, `{{researchYear}}`, `{{signerName}}`, `{{signerTitle}}`, `{{studyProgram}}`
- **Field tambahan yang direkomendasikan untuk form admin:**

| Label | Key | Tipe | Wajib | Opsi |
|---|---|---|---|---|
| Nama program/hibah | `{{programName}}` | teks | Ya | - |
| Tautan program/hibah | `{{programUrl}}` | teks | Tidak | - |
| Tempat penerbitan surat | `{{letterPlace}}` | teks | Ya | - |

### A06_Surat_Tugas_Penelitian_Industri.docx

- **Kategori:** `research_assignment`
- **Kepentingan:** Penelitian Industri
- **Placeholder yang digunakan:** `{{applicantIdentifier}}`, `{{applicantName}}`, `{{applicantRole}}`, `{{faculty}}`, `{{letterDate}}`, `{{letterNumber}}`, `{{letterPlace}}`, `{{partnerInstitution}}`, `{{partnerName}}`, `{{partnerOrigin}}`, `{{partnerScale}}`, `{{researchDuration}}`, `{{researchLocation}}`, `{{researchRole}}`, `{{researchScheme}}`, `{{researchTeam}}`, `{{researchTitle}}`, `{{researchYear}}`, `{{signerName}}`, `{{signerTitle}}`, `{{studyProgram}}`
- **Field tambahan yang direkomendasikan untuk form admin:**

| Label | Key | Tipe | Wajib | Opsi |
|---|---|---|---|---|
| Nama mitra | `{{partnerName}}` | teks | Tidak | - |
| Institusi mitra | `{{partnerInstitution}}` | teks | Tidak | - |
| Asal mitra industri | `{{partnerOrigin}}` | teks | Tidak | - |
| Skala mitra industri | `{{partnerScale}}` | pilihan | Tidak | lokal, nasional, multinasional, lainnya |
| Tempat penerbitan surat | `{{letterPlace}}` | teks | Ya | - |

### A07_Surat_Tugas_Publikasi_Jurnal.docx

- **Kategori:** `research_assignment`
- **Kepentingan:** Publikasi Jurnal
- **Placeholder yang digunakan:** `{{applicantIdentifier}}`, `{{applicantName}}`, `{{applicantRole}}`, `{{authorPosition}}`, `{{category}}`, `{{faculty}}`, `{{indexing}}`, `{{letterDate}}`, `{{letterNumber}}`, `{{letterPlace}}`, `{{publicationName}}`, `{{publicationRole}}`, `{{publicationStatus}}`, `{{signerName}}`, `{{signerTitle}}`, `{{studyProgram}}`, `{{title}}`, `{{url}}`
- **Field tambahan yang direkomendasikan untuk form admin:**

| Label | Key | Tipe | Wajib | Opsi |
|---|---|---|---|---|
| Judul publikasi/karya | `{{title}}` | teks panjang | Ya | - |
| Nama jurnal/prosiding/penerbit | `{{publicationName}}` | teks | Ya | - |
| Kategori publikasi | `{{category}}` | teks | Tidak | - |
| Indeks/ISBN/ISSN | `{{indexing}}` | teks | Tidak | - |
| Tautan publikasi | `{{url}}` | teks | Tidak | - |
| Peran publikasi | `{{publicationRole}}` | teks | Tidak | - |
| Posisi penulis | `{{authorPosition}}` | teks | Tidak | - |
| Status publikasi | `{{publicationStatus}}` | pilihan | Ya | diajukan, diterima, terbit, lainnya |
| Tempat penerbitan surat | `{{letterPlace}}` | teks | Ya | - |

### A08_Surat_Tugas_Publikasi_Prosiding.docx

- **Kategori:** `research_assignment`
- **Kepentingan:** Publikasi Prosiding
- **Placeholder yang digunakan:** `{{applicantIdentifier}}`, `{{applicantName}}`, `{{applicantRole}}`, `{{authorPosition}}`, `{{category}}`, `{{faculty}}`, `{{indexing}}`, `{{letterDate}}`, `{{letterNumber}}`, `{{letterPlace}}`, `{{publicationName}}`, `{{publicationRole}}`, `{{publicationStatus}}`, `{{signerName}}`, `{{signerTitle}}`, `{{studyProgram}}`, `{{title}}`, `{{url}}`
- **Field tambahan yang direkomendasikan untuk form admin:**

| Label | Key | Tipe | Wajib | Opsi |
|---|---|---|---|---|
| Judul publikasi/karya | `{{title}}` | teks panjang | Ya | - |
| Nama jurnal/prosiding/penerbit | `{{publicationName}}` | teks | Ya | - |
| Kategori publikasi | `{{category}}` | teks | Tidak | - |
| Indeks/ISBN/ISSN | `{{indexing}}` | teks | Tidak | - |
| Tautan publikasi | `{{url}}` | teks | Tidak | - |
| Peran publikasi | `{{publicationRole}}` | teks | Tidak | - |
| Posisi penulis | `{{authorPosition}}` | teks | Tidak | - |
| Status publikasi | `{{publicationStatus}}` | pilihan | Ya | diajukan, diterima, terbit, lainnya |
| Tempat penerbitan surat | `{{letterPlace}}` | teks | Ya | - |

### A09_Surat_Tugas_Publikasi_Buku.docx

- **Kategori:** `research_assignment`
- **Kepentingan:** Publikasi Buku
- **Placeholder yang digunakan:** `{{applicantIdentifier}}`, `{{applicantName}}`, `{{applicantRole}}`, `{{authorPosition}}`, `{{category}}`, `{{faculty}}`, `{{indexing}}`, `{{letterDate}}`, `{{letterNumber}}`, `{{letterPlace}}`, `{{publicationName}}`, `{{publicationRole}}`, `{{publicationStatus}}`, `{{signerName}}`, `{{signerTitle}}`, `{{studyProgram}}`, `{{title}}`, `{{url}}`
- **Field tambahan yang direkomendasikan untuk form admin:**

| Label | Key | Tipe | Wajib | Opsi |
|---|---|---|---|---|
| Judul publikasi/karya | `{{title}}` | teks panjang | Ya | - |
| Nama jurnal/prosiding/penerbit | `{{publicationName}}` | teks | Ya | - |
| Kategori publikasi | `{{category}}` | teks | Tidak | - |
| Indeks/ISBN/ISSN | `{{indexing}}` | teks | Tidak | - |
| Tautan publikasi | `{{url}}` | teks | Tidak | - |
| Peran publikasi | `{{publicationRole}}` | teks | Tidak | - |
| Posisi penulis | `{{authorPosition}}` | teks | Tidak | - |
| Status publikasi | `{{publicationStatus}}` | pilihan | Ya | diajukan, diterima, terbit, lainnya |
| Tempat penerbitan surat | `{{letterPlace}}` | teks | Ya | - |

### A10_Surat_Tugas_Seminar_Ilmiah.docx

- **Kategori:** `research_assignment`
- **Kepentingan:** Seminar Ilmiah
- **Placeholder yang digunakan:** `{{applicantIdentifier}}`, `{{applicantName}}`, `{{applicantRole}}`, `{{eventCategory}}`, `{{eventLocation}}`, `{{eventName}}`, `{{eventOrganizer}}`, `{{faculty}}`, `{{letterDate}}`, `{{letterNumber}}`, `{{letterPlace}}`, `{{role}}`, `{{signerName}}`, `{{signerTitle}}`, `{{studyProgram}}`
- **Field tambahan yang direkomendasikan untuk form admin:**

| Label | Key | Tipe | Wajib | Opsi |
|---|---|---|---|---|
| Nama seminar | `{{eventName}}` | teks | Ya | - |
| Kategori seminar | `{{eventCategory}}` | teks | Tidak | - |
| Lokasi seminar | `{{eventLocation}}` | teks | Ya | - |
| Penyelenggara seminar | `{{eventOrganizer}}` | teks | Ya | - |
| Peran peserta | `{{role}}` | teks | Ya | - |
| Tempat penerbitan surat | `{{letterPlace}}` | teks | Ya | - |

### A11_Surat_Tugas_Karya_Seni.docx

- **Kategori:** `research_assignment`
- **Kepentingan:** Karya Seni
- **Placeholder yang digunakan:** `{{applicantIdentifier}}`, `{{applicantName}}`, `{{applicantRole}}`, `{{faculty}}`, `{{letterDate}}`, `{{letterNumber}}`, `{{letterPlace}}`, `{{location}}`, `{{organizer}}`, `{{outputType}}`, `{{signerName}}`, `{{signerTitle}}`, `{{studyProgram}}`, `{{title}}`
- **Field tambahan yang direkomendasikan untuk form admin:**

| Label | Key | Tipe | Wajib | Opsi |
|---|---|---|---|---|
| Jenis karya seni | `{{outputType}}` | teks | Ya | - |
| Judul publikasi/karya | `{{title}}` | teks panjang | Ya | - |
| Lokasi/publikasi karya | `{{location}}` | teks | Tidak | - |
| Penyelenggara | `{{organizer}}` | teks | Tidak | - |
| Tempat penerbitan surat | `{{letterPlace}}` | teks | Ya | - |

### B01_Surat_Permohonan_Izin_Penelitian.docx

- **Kategori:** `support`
- **Kepentingan:** Permohonan Izin Penelitian
- **Placeholder yang digunakan:** `{{activityEndDate}}`, `{{activityPurpose}}`, `{{activityStartDate}}`, `{{applicantIdentifier}}`, `{{applicantName}}`, `{{applicantRole}}`, `{{faculty}}`, `{{letterDate}}`, `{{letterNumber}}`, `{{letterPlace}}`, `{{recipientInstitution}}`, `{{recipientName}}`, `{{recipientPosition}}`, `{{researchLocation}}`, `{{researchObject}}`, `{{researchScheme}}`, `{{researchTitle}}`, `{{researchYear}}`, `{{signerName}}`, `{{signerTitle}}`, `{{studyProgram}}`
- **Field tambahan yang direkomendasikan untuk form admin:**

| Label | Key | Tipe | Wajib | Opsi |
|---|---|---|---|---|
| Nama penerima surat | `{{recipientName}}` | teks | Tidak | - |
| Jabatan penerima | `{{recipientPosition}}` | teks | Tidak | - |
| Instansi tujuan | `{{recipientInstitution}}` | teks | Tidak | - |
| Lokasi/objek/subjek kegiatan penelitian | `{{researchObject}}` | teks panjang | Tidak | - |
| Tanggal mulai kegiatan | `{{activityStartDate}}` | tanggal | Tidak | - |
| Tanggal selesai kegiatan | `{{activityEndDate}}` | tanggal | Tidak | - |
| Tujuan kegiatan | `{{activityPurpose}}` | teks panjang | Tidak | - |
| Tempat penerbitan surat | `{{letterPlace}}` | teks | Ya | - |

### B02_Surat_Permohonan_Observasi.docx

- **Kategori:** `support`
- **Kepentingan:** Observasi
- **Placeholder yang digunakan:** `{{activityEndDate}}`, `{{activityName}}`, `{{activityPurpose}}`, `{{activityStartDate}}`, `{{applicantIdentifier}}`, `{{applicantName}}`, `{{applicantRole}}`, `{{faculty}}`, `{{letterDate}}`, `{{letterNumber}}`, `{{letterPlace}}`, `{{recipientInstitution}}`, `{{recipientName}}`, `{{recipientPosition}}`, `{{researchLocation}}`, `{{researchObject}}`, `{{researchTitle}}`, `{{signerName}}`, `{{signerTitle}}`, `{{studyProgram}}`
- **Field tambahan yang direkomendasikan untuk form admin:**

| Label | Key | Tipe | Wajib | Opsi |
|---|---|---|---|---|
| Nama penerima surat | `{{recipientName}}` | teks | Tidak | - |
| Jabatan penerima | `{{recipientPosition}}` | teks | Tidak | - |
| Instansi tujuan | `{{recipientInstitution}}` | teks | Tidak | - |
| Nama kegiatan | `{{activityName}}` | teks | Tidak | - |
| Lokasi/objek/subjek kegiatan penelitian | `{{researchObject}}` | teks panjang | Tidak | - |
| Tanggal mulai kegiatan | `{{activityStartDate}}` | tanggal | Tidak | - |
| Tanggal selesai kegiatan | `{{activityEndDate}}` | tanggal | Tidak | - |
| Tujuan kegiatan | `{{activityPurpose}}` | teks panjang | Tidak | - |
| Tempat penerbitan surat | `{{letterPlace}}` | teks | Ya | - |

### B03_Surat_Permohonan_Wawancara.docx

- **Kategori:** `support`
- **Kepentingan:** Wawancara
- **Placeholder yang digunakan:** `{{activityEndDate}}`, `{{activityName}}`, `{{activityPurpose}}`, `{{activityStartDate}}`, `{{applicantIdentifier}}`, `{{applicantName}}`, `{{applicantRole}}`, `{{faculty}}`, `{{letterDate}}`, `{{letterNumber}}`, `{{letterPlace}}`, `{{recipientInstitution}}`, `{{recipientName}}`, `{{recipientPosition}}`, `{{researchLocation}}`, `{{researchObject}}`, `{{researchTitle}}`, `{{signerName}}`, `{{signerTitle}}`, `{{studyProgram}}`
- **Field tambahan yang direkomendasikan untuk form admin:**

| Label | Key | Tipe | Wajib | Opsi |
|---|---|---|---|---|
| Nama penerima surat | `{{recipientName}}` | teks | Tidak | - |
| Jabatan penerima | `{{recipientPosition}}` | teks | Tidak | - |
| Instansi tujuan | `{{recipientInstitution}}` | teks | Tidak | - |
| Nama kegiatan | `{{activityName}}` | teks | Tidak | - |
| Lokasi/objek/subjek kegiatan penelitian | `{{researchObject}}` | teks panjang | Tidak | - |
| Tanggal mulai kegiatan | `{{activityStartDate}}` | tanggal | Tidak | - |
| Tanggal selesai kegiatan | `{{activityEndDate}}` | tanggal | Tidak | - |
| Tujuan kegiatan | `{{activityPurpose}}` | teks panjang | Tidak | - |
| Tempat penerbitan surat | `{{letterPlace}}` | teks | Ya | - |

### B04_Surat_Permohonan_Workshop.docx

- **Kategori:** `support`
- **Kepentingan:** Workshop
- **Placeholder yang digunakan:** `{{activityName}}`, `{{activityPurpose}}`, `{{applicantIdentifier}}`, `{{applicantName}}`, `{{applicantRole}}`, `{{eventDatetime}}`, `{{faculty}}`, `{{letterDate}}`, `{{letterNumber}}`, `{{letterPlace}}`, `{{recipientInstitution}}`, `{{recipientName}}`, `{{recipientPosition}}`, `{{researchScheme}}`, `{{researchTitle}}`, `{{researchYear}}`, `{{signerName}}`, `{{signerTitle}}`, `{{studyProgram}}`
- **Field tambahan yang direkomendasikan untuk form admin:**

| Label | Key | Tipe | Wajib | Opsi |
|---|---|---|---|---|
| Nama penerima surat | `{{recipientName}}` | teks | Tidak | - |
| Jabatan penerima | `{{recipientPosition}}` | teks | Tidak | - |
| Instansi tujuan | `{{recipientInstitution}}` | teks | Tidak | - |
| Nama kegiatan | `{{activityName}}` | teks | Tidak | - |
| Waktu kegiatan | `{{eventDatetime}}` | tanggal-waktu | Ya | - |
| Tujuan kegiatan | `{{activityPurpose}}` | teks panjang | Tidak | - |
| Tempat penerbitan surat | `{{letterPlace}}` | teks | Ya | - |

### B05_Surat_Permohonan_FGD.docx

- **Kategori:** `support`
- **Kepentingan:** FGD
- **Placeholder yang digunakan:** `{{activityName}}`, `{{activityPurpose}}`, `{{applicantIdentifier}}`, `{{applicantName}}`, `{{applicantRole}}`, `{{eventDatetime}}`, `{{faculty}}`, `{{letterDate}}`, `{{letterNumber}}`, `{{letterPlace}}`, `{{recipientInstitution}}`, `{{recipientName}}`, `{{recipientPosition}}`, `{{researchScheme}}`, `{{researchTitle}}`, `{{researchYear}}`, `{{signerName}}`, `{{signerTitle}}`, `{{studyProgram}}`
- **Field tambahan yang direkomendasikan untuk form admin:**

| Label | Key | Tipe | Wajib | Opsi |
|---|---|---|---|---|
| Nama penerima surat | `{{recipientName}}` | teks | Tidak | - |
| Jabatan penerima | `{{recipientPosition}}` | teks | Tidak | - |
| Instansi tujuan | `{{recipientInstitution}}` | teks | Tidak | - |
| Nama kegiatan | `{{activityName}}` | teks | Tidak | - |
| Waktu kegiatan | `{{eventDatetime}}` | tanggal-waktu | Ya | - |
| Tujuan kegiatan | `{{activityPurpose}}` | teks panjang | Tidak | - |
| Tempat penerbitan surat | `{{letterPlace}}` | teks | Ya | - |

### B06_Surat_Permohonan_Kegiatan_Penelitian_Lainnya.docx

- **Kategori:** `support`
- **Kepentingan:** Kegiatan Penelitian Lainnya
- **Placeholder yang digunakan:** `{{activityName}}`, `{{activityPurpose}}`, `{{applicantIdentifier}}`, `{{applicantName}}`, `{{applicantRole}}`, `{{eventDatetime}}`, `{{faculty}}`, `{{letterDate}}`, `{{letterNumber}}`, `{{letterPlace}}`, `{{recipientInstitution}}`, `{{recipientName}}`, `{{recipientPosition}}`, `{{researchScheme}}`, `{{researchTitle}}`, `{{researchYear}}`, `{{signerName}}`, `{{signerTitle}}`, `{{studyProgram}}`
- **Field tambahan yang direkomendasikan untuk form admin:**

| Label | Key | Tipe | Wajib | Opsi |
|---|---|---|---|---|
| Nama penerima surat | `{{recipientName}}` | teks | Tidak | - |
| Jabatan penerima | `{{recipientPosition}}` | teks | Tidak | - |
| Instansi tujuan | `{{recipientInstitution}}` | teks | Tidak | - |
| Nama kegiatan | `{{activityName}}` | teks | Tidak | - |
| Waktu kegiatan | `{{eventDatetime}}` | tanggal-waktu | Ya | - |
| Tujuan kegiatan | `{{activityPurpose}}` | teks panjang | Tidak | - |
| Tempat penerbitan surat | `{{letterPlace}}` | teks | Ya | - |

### C01_Permohonan_Klirens_Etik_Baru.docx

- **Kategori:** `ethics`
- **Kepentingan:** Permohonan Klirens Etik Baru
- **Placeholder yang digunakan:** `{{activityPurpose}}`, `{{applicantEmail}}`, `{{applicantIdentifier}}`, `{{applicantName}}`, `{{applicantRole}}`, `{{faculty}}`, `{{letterDate}}`, `{{letterNumber}}`, `{{letterPlace}}`, `{{researchStartDate}}`, `{{researchTitle}}`, `{{signerName}}`, `{{signerTitle}}`, `{{studyProgram}}`
- **Field tambahan yang direkomendasikan untuk form admin:**

| Label | Key | Tipe | Wajib | Opsi |
|---|---|---|---|---|
| Tanggal mulai penelitian | `{{researchStartDate}}` | tanggal | Ya | - |
| Tujuan kegiatan | `{{activityPurpose}}` | teks panjang | Tidak | - |
| Tempat penerbitan surat | `{{letterPlace}}` | teks | Ya | - |

### C02_Permohonan_Perpanjangan_Klirens_Etik.docx

- **Kategori:** `ethics`
- **Kepentingan:** Permohonan Perpanjangan Klirens Etik
- **Placeholder yang digunakan:** `{{activityPurpose}}`, `{{applicantEmail}}`, `{{applicantIdentifier}}`, `{{applicantName}}`, `{{applicantRole}}`, `{{expiryDate}}`, `{{faculty}}`, `{{letterDate}}`, `{{letterNumber}}`, `{{letterPlace}}`, `{{previousClearanceId}}`, `{{previousClearanceNumber}}`, `{{researchStartDate}}`, `{{researchTitle}}`, `{{signerName}}`, `{{signerTitle}}`, `{{studyProgram}}`
- **Field tambahan yang direkomendasikan untuk form admin:**

| Label | Key | Tipe | Wajib | Opsi |
|---|---|---|---|---|
| Tanggal mulai penelitian | `{{researchStartDate}}` | tanggal | Ya | - |
| Tujuan kegiatan | `{{activityPurpose}}` | teks panjang | Tidak | - |
| ID klirens etik sebelumnya | `{{previousClearanceId}}` | teks | Tidak | - |
| Nomor klirens etik sebelumnya | `{{previousClearanceNumber}}` | teks | Ya | - |
| Tanggal kedaluwarsa klirens sebelumnya | `{{expiryDate}}` | tanggal | Ya | - |
| Tempat penerbitan surat | `{{letterPlace}}` | teks | Ya | - |

### D01_Surat_Tugas_Perjalanan_Dinas_Penelitian.docx

- **Kategori:** `travel`
- **Kepentingan:** Perjalanan Dinas Penelitian
- **Placeholder yang digunakan:** `{{activityName}}`, `{{activityPurpose}}`, `{{applicantIdentifier}}`, `{{applicantName}}`, `{{applicantRole}}`, `{{departureDate}}`, `{{faculty}}`, `{{fundingSource}}`, `{{letterDate}}`, `{{letterNumber}}`, `{{letterPlace}}`, `{{researchScheme}}`, `{{researchTitle}}`, `{{returnDate}}`, `{{signerName}}`, `{{signerTitle}}`, `{{studyProgram}}`, `{{transportMode}}`, `{{travelDestination}}`, `{{travelSchedule}}`
- **Field tambahan yang direkomendasikan untuk form admin:**

| Label | Key | Tipe | Wajib | Opsi |
|---|---|---|---|---|
| Nama kegiatan | `{{activityName}}` | teks | Tidak | - |
| Tujuan perjalanan | `{{travelDestination}}` | teks | Ya | - |
| Tanggal berangkat | `{{departureDate}}` | tanggal | Ya | - |
| Tanggal kembali | `{{returnDate}}` | tanggal | Ya | - |
| Moda transportasi | `{{transportMode}}` | teks | Tidak | - |
| Tujuan kegiatan | `{{activityPurpose}}` | teks panjang | Tidak | - |
| Sumber dana | `{{fundingSource}}` | teks | Tidak | - |
| Jadwal/rundown perjalanan | `{{travelSchedule}}` | teks panjang | Tidak | - |
| Tempat penerbitan surat | `{{letterPlace}}` | teks | Ya | - |

### E01_Surat_Custom.docx

- **Kategori:** `custom`
- **Kepentingan:** Custom
- **Placeholder yang digunakan:** `{{applicantEmail}}`, `{{applicantIdentifier}}`, `{{applicantName}}`, `{{applicantRole}}`, `{{customContent}}`, `{{customLetterTitle}}`, `{{letterDate}}`, `{{letterNumber}}`, `{{letterPlace}}`, `{{signerName}}`, `{{signerTitle}}`
- **Field tambahan yang direkomendasikan untuk form admin:**

| Label | Key | Tipe | Wajib | Opsi |
|---|---|---|---|---|
| Judul surat custom | `{{customLetterTitle}}` | teks | Ya | - |
| Isi surat custom | `{{customContent}}` | teks panjang | Ya | - |
| Tempat penerbitan surat | `{{letterPlace}}` | teks | Ya | - |

## Pemetaan seluruh file

| File | Kategori | Kepentingan |
|---|---|---|
| `A01_Surat_Tugas_Penelitian_Mandiri.docx` | `research_assignment` | Penelitian Mandiri |
| `A02_Surat_Tugas_Penelitian_Kerja_Sama_PT_Dalam_Negeri.docx` | `research_assignment` | Penelitian Kerja Sama Perguruan Tinggi Dalam Negeri |
| `A03_Surat_Tugas_Penelitian_Kerja_Sama_PT_Luar_Negeri.docx` | `research_assignment` | Penelitian Kerja Sama Perguruan Tinggi Luar Negeri |
| `A04_Surat_Tugas_Penelitian_Hibah_Internal.docx` | `research_assignment` | Penelitian Hibah Internal |
| `A05_Surat_Tugas_Penelitian_Pemerintah.docx` | `research_assignment` | Penelitian Pemerintah |
| `A06_Surat_Tugas_Penelitian_Industri.docx` | `research_assignment` | Penelitian Industri |
| `A07_Surat_Tugas_Publikasi_Jurnal.docx` | `research_assignment` | Publikasi Jurnal |
| `A08_Surat_Tugas_Publikasi_Prosiding.docx` | `research_assignment` | Publikasi Prosiding |
| `A09_Surat_Tugas_Publikasi_Buku.docx` | `research_assignment` | Publikasi Buku |
| `A10_Surat_Tugas_Seminar_Ilmiah.docx` | `research_assignment` | Seminar Ilmiah |
| `A11_Surat_Tugas_Karya_Seni.docx` | `research_assignment` | Karya Seni |
| `B01_Surat_Permohonan_Izin_Penelitian.docx` | `support` | Permohonan Izin Penelitian |
| `B02_Surat_Permohonan_Observasi.docx` | `support` | Observasi |
| `B03_Surat_Permohonan_Wawancara.docx` | `support` | Wawancara |
| `B04_Surat_Permohonan_Workshop.docx` | `support` | Workshop |
| `B05_Surat_Permohonan_FGD.docx` | `support` | FGD |
| `B06_Surat_Permohonan_Kegiatan_Penelitian_Lainnya.docx` | `support` | Kegiatan Penelitian Lainnya |
| `C01_Permohonan_Klirens_Etik_Baru.docx` | `ethics` | Permohonan Klirens Etik Baru |
| `C02_Permohonan_Perpanjangan_Klirens_Etik.docx` | `ethics` | Permohonan Perpanjangan Klirens Etik |
| `D01_Surat_Tugas_Perjalanan_Dinas_Penelitian.docx` | `travel` | Perjalanan Dinas Penelitian |
| `E01_Surat_Custom.docx` | `custom` | Custom |

## Checklist produksi PDF

1. Ganti seluruh placeholder `{{...}}` dengan data final.
2. Hapus placeholder/row opsional yang tidak memiliki nilai sehingga token tidak terlihat kepada penerima.
3. Ganti `[LOGO RESMI RIS]` dengan logo RIS resmi jika aset tersedia, atau hapus area tersebut jika diputuskan tidak digunakan.
4. Pastikan `{{letterNumber}}`, `{{letterDate}}`, `{{signerName}}`, dan `{{signerTitle}}` sudah terisi sebelum finalisasi.
5. Konversi dokumen hasil pengisian ke PDF dan lakukan pemeriksaan visual sebelum dikirim.

## Catatan Pembaruan Logo RIS
Pada seluruh template, placeholder header `[LOGO RESMI RIS]` telah diganti dengan gambar logo RIS resmi berukuran moderat, sementara elemen header lainnya tetap dipertahankan.
