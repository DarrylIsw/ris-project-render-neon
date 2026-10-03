# Paket Templat Ekspor RIS UMN

Paket ini berisi satu templat Word untuk ekspor profil dosen/peneliti dan tiga templat CSV kosong. Templat tidak memuat password, hash password, token, data sesi, atau rahasia sistem.

## 1. Template Word

**File:** `Template_Ekspor_Profil_Dosen_RIS.docx`  
**Tujuan:** diisi aplikasi RIS dan diunduh sebagai dokumen Word (`.docx`) pada fitur **Ekspor Word** di detail profil dosen.  
**Format:** A4 potret, Bahasa Indonesia, dengan logo resmi RIS dan UMN yang telah diberikan. Footer memuat `{{exportedAt}}` serta nomor halaman.

### Pemetaan placeholder profil

| Placeholder | Arti |
|---|---|
| `{{frontTitle}}` | Gelar depan |
| `{{fullName}}` | Nama lengkap |
| `{{backTitle}}` | Gelar belakang |
| `{{profilePhoto}}` | Foto profil atau representasi gambar yang didukung engine template |
| `{{nidn}}` | NIDN |
| `{{nik}}` | NIK |
| `{{birthPlace}}` | Tempat lahir |
| `{{birthDate}}` | Tanggal lahir |
| `{{gender}}` | Jenis kelamin |
| `{{nationality}}` | Kewarganegaraan |
| `{{institutionEmail}}` | Email institusi |
| `{{alternateEmail}}` | Email alternatif |
| `{{phoneNumber}}` | Nomor telepon |
| `{{domicileAddress}}` | Alamat domisili |
| `{{correspondenceAddress}}` | Alamat korespondensi |
| `{{faculty}}` | Fakultas |
| `{{studyProgram}}` | Program studi |
| `{{unit}}` | Unit |
| `{{position}}` | Posisi |
| `{{functionalPosition}}` | Jabatan fungsional |
| `{{nip}}` | NIP |
| `{{orcid}}` | ORCID |
| `{{googleScholar}}` | Identitas/tautan Google Scholar |
| `{{sintaId}}` | SINTA ID |
| `{{bankName}}` | Nama bank |
| `{{bankAccountNumber}}` | Nomor rekening |
| `{{bankAccountName}}` | Nama pemilik rekening |
| `{{emergencyContactName}}` | Nama kontak darurat |
| `{{emergencyContactRelation}}` | Relasi kontak darurat |
| `{{emergencyContactPhone}}` | Nomor telepon kontak darurat |
| `{{accountStatus}}` | Aktif / Nonaktif / Dihapus |
| `{{profileStatus}}` | Status profil |
| `{{verificationStatus}}` | Status verifikasi |
| `{{profileCompleteness}}` | Persentase kelengkapan profil |
| `{{createdAt}}` | Tanggal profil dibuat |
| `{{updatedAt}}` | Tanggal profil diperbarui |
| `{{exportedAt}}` | Tanggal dokumen diekspor |
| `{{profileAdminName}}` | Administrator pendamping |

### Placeholder berulang

- Bidang keahlian: `{{#expertise}} ... {{expertiseName}} ... {{/expertise}}`
- Dokumen profil: `{{#documents}} ... {{documentType}} ... {{fileName}} ... {{fileFormat}} ... {{fileSize}} ... {{uploadedAt}} ... {{/documents}}`
- Riwayat verifikasi: `{{#verificationHistory}} ... {{historyStatus}} ... {{historyNotes}} ... {{verifiedAt}} ... {{/verificationHistory}}`

Jika engine DOCX yang dipilih tidak mendukung loop/section Mustache, perlakukan masing-masing tabel tersebut sebagai **template tabel**: aplikasi menggandakan baris data sesuai jumlah item, mengganti placeholder per baris, lalu menghapus baris template. Jika daftar kosong, sembunyikan bagian atau hapus baris data sesuai spesifikasi. Placeholder scalar yang kosong sebaiknya dirender sebagai string kosong atau `-`, bukan menimbulkan error. `{{profilePhoto}}` memerlukan dukungan penggantian placeholder dengan gambar; jika tidak tersedia, tampilkan ruang foto kosong atau `-`.

## 2. Template CSV Profil Peneliti

**File:** `Template_Profil_Peneliti.csv`

Kolom berurutan: Nama; Email Institusi; NIDN; Fakultas; Program Studi; Posisi; Kelengkapan; Verifikasi; Bidang Minat. `Bidang Minat` mengikuti nilai yang disediakan aplikasi. File template hanya berisi header.

## 3. Template CSV Arsip Pengguna

**File:** `Template_Arsip_Pengguna.csv`

Kolom mengikuti urutan yang ditetapkan pada spesifikasi: identitas pengguna, peran/cakupan admin, identitas akademik, status dan kelengkapan profil, bidang keahlian, status akun, ringkasan aktivitas/penugasan, administrator pendamping, dan tanggal pembuatan/pembaruan. Nilai jamak pada **Cakupan Admin** dan **Bidang Keahlian** digabung dengan titik koma (`;`). Status akun menggunakan tepat **Aktif**, **Nonaktif**, atau **Dihapus**. Nilai yang tidak tersedia dibiarkan kosong, kecuali field status yang memang memiliki fallback aplikasi.

## 4. Template CSV Arsip Penelitian

**File:** `Template_Arsip_Penelitian.csv`

Kolom mengikuti urutan yang ditetapkan pada spesifikasi, mulai dari ID Arsip sampai Catatan Arsip. Nilai jamak seperti **Tag Arsip** digabung dengan titik koma (`;`). Field yang tidak relevan untuk jenis penelitian dibiarkan kosong.


## Arti Kolom CSV

### `Template_Profil_Peneliti.csv`

| Kolom | Arti |
|---|---|
| Nama | Nama dosen/peneliti. |
| Email Institusi | Alamat email institusi. |
| NIDN | Nomor Induk Dosen Nasional. |
| Fakultas | Fakultas peneliti. |
| Program Studi | Program studi peneliti. |
| Posisi | Posisi peneliti pada institusi. |
| Kelengkapan | Nilai/status kelengkapan profil sesuai keluaran aplikasi. |
| Verifikasi | Status verifikasi profil. |
| Bidang Minat | Bidang minat peneliti sesuai data aplikasi. |

### `Template_Arsip_Pengguna.csv`

| Kolom | Arti |
|---|---|
| ID Pengguna | ID internal pengguna pada aplikasi. |
| Nama | Nama pengguna. |
| Email | Email pengguna. |
| Peran | Peran pengguna pada aplikasi. |
| Cakupan Admin | Cakupan kewenangan admin; banyak nilai digabung dengan titik koma. |
| NIDN / Identitas | NIDN atau identitas lain yang digunakan akun. |
| Unit / Fakultas | Unit atau fakultas pengguna. |
| Program Studi | Program studi pengguna. |
| Jabatan | Jabatan pengguna. |
| Status Profil | Status profil pengguna. |
| Kelengkapan Profil (%) | Persentase kelengkapan profil. |
| Bidang Keahlian | Daftar bidang keahlian; banyak nilai digabung dengan titik koma. |
| Status Akun | Status akun: Aktif, Nonaktif, atau Dihapus. |
| Alasan Nonaktif | Alasan penonaktifan akun jika tersedia/relevan. |
| Penelitian sebagai Ketua | Ringkasan/jumlah penelitian pengguna sebagai ketua sesuai data aplikasi. |
| Penelitian sebagai Anggota | Ringkasan/jumlah penelitian pengguna sebagai anggota sesuai data aplikasi. |
| Penelitian Eksternal | Ringkasan/jumlah penelitian eksternal pengguna sesuai data aplikasi. |
| Pengajuan Surat | Ringkasan/jumlah pengajuan surat pengguna sesuai data aplikasi. |
| Dokumen Profil | Ringkasan/jumlah dokumen profil pengguna sesuai data aplikasi. |
| Penugasan Penilaian Proposal | Ringkasan/jumlah penugasan penilaian proposal. |
| Penugasan Penilaian Penelitian Didanai | Ringkasan/jumlah penugasan penilaian penelitian didanai. |
| Administrator Pendamping | Nama/identitas administrator pendamping bila tersedia. |
| Tanggal Dibuat | Tanggal/waktu data pengguna dibuat. |
| Tanggal Diperbarui | Tanggal/waktu data pengguna terakhir diperbarui. |

### `Template_Arsip_Penelitian.csv`

| Kolom | Arti |
|---|---|
| ID Arsip | ID arsip penelitian pada aplikasi. |
| Sumber | Sumber data/arsip penelitian. |
| Judul Penelitian | Judul penelitian. |
| ID Pemilik | ID internal pemilik penelitian. |
| Pemilik | Nama pemilik penelitian. |
| Tahun | Tahun penelitian. |
| Skema / Kategori | Skema atau kategori penelitian. |
| Status | Status penelitian/arsip sesuai data aplikasi. |
| Diperbarui | Tanggal/waktu pembaruan terakhir. |
| Status Verifikasi | Status verifikasi penelitian/arsip. |
| Keputusan | Keputusan yang tercatat untuk penelitian/arsip. |
| Nomor Surat Pendanaan | Nomor surat pendanaan bila tersedia. |
| Status Kontrak | Status kontrak bila relevan. |
| Jumlah Anggota | Jumlah anggota penelitian. |
| Item Anggaran | Ringkasan/jumlah item anggaran sesuai data aplikasi. |
| Luaran | Ringkasan/daftar luaran penelitian sesuai data aplikasi. |
| Lampiran / Dokumen | Ringkasan/daftar lampiran atau dokumen terkait. |
| Jumlah Monev | Jumlah kegiatan/catatan monitoring dan evaluasi. |
| Laporan Kemajuan / Akhir | Status/ringkasan ketersediaan laporan kemajuan atau akhir. |
| Laporan Luaran | Status/ringkasan laporan luaran. |
| Logbook | Status/ringkasan logbook penelitian. |
| Penugasan Penilai | Ringkasan penugasan penilai. |
| Hasil Penilaian | Ringkasan hasil penilaian. |
| Jenis Penelitian Eksternal | Jenis penelitian eksternal bila relevan. |
| Status Kegiatan Eksternal | Status kegiatan eksternal bila relevan. |
| Pendanaan Eksternal | Nilai/informasi pendanaan eksternal bila relevan. |
| Mata Uang | Mata uang pendanaan eksternal bila relevan. |
| Tag Arsip | Tag arsip; banyak nilai digabung dengan titik koma. |
| Catatan Arsip | Catatan arsip penelitian. |

## Format CSV

Ketiga CSV menggunakan: UTF-8 dengan BOM, delimiter koma, baris CRLF, dan seluruh nilai diapit tanda kutip ganda. Tanda kutip di dalam nilai harus di-escape dengan menggandakannya.

**Format tanggal CSV:** ISO 8601, misalnya `2026-10-02` atau `2026-10-02T09:30:00+07:00` bila waktu diperlukan.  
**Format tanggal PDF:** format Indonesia yang mudah dibaca, misalnya `2 Oktober 2026`; waktu dapat ditambahkan bila relevan.

### Pencegahan formula injection CSV

Saat mengekspor nilai dinamis, periksa nilai setelah spasi awal yang relevan. Jika karakter pertama adalah `=`, `+`, `-`, atau `@`, perlakukan sebagai teks aman, misalnya dengan menambahkan apostrof (`'`) sebelum nilai. Lakukan sanitasi **sebelum** quoting CSV. Jangan mengubah nama atau urutan kolom.

## Catatan implementasi

- Ekspor profil dosen mengisi templat Word di server dan mengunduh hasilnya sebagai `.docx`; tidak memerlukan LibreOffice.
- CSV profil mengikuti kolom yang ditetapkan dalam spesifikasi.
- CSV arsip pengguna dan penelitian digunakan pada menu Arsip.
- Arsip laporan penelitian eksternal diunduh sebagai PDF ringkasan terstruktur; fitur tersebut tidak memakai templat profil dosen.
- Bagian keuangan pada Word ditandai sebagai **informasi terbatas/rahasia**; kontrol akses tetap harus diterapkan oleh aplikasi.
- Jangan memasukkan password, hash password, token, cookie/sesi, secret key, atau rahasia sistem ke ekspor.
- File Word adalah dokumen yang diisi dan diunduh langsung oleh pengguna sebagai `.docx`; ekspor ini tidak memerlukan konversi PDF.
