import { useState } from 'react';
import { formatDate, formatHa, formatInt, lotAgeMonths } from './farmMapUtils';

const btn = 'flex-1 rounded-md border border-[#164E33] px-2 py-1.5 text-xs font-semibold text-emerald-100 hover:bg-[#164E33]/60';

function Row({ label, children }) {
  return (
    <>
      <dt className="text-emerald-100/55">{label}</dt>
      <dd className="text-right font-medium tabular-nums">{children}</dd>
    </>
  );
}

/** Thẻ chi tiết lô + thao tác nhanh cho người đi hiện trường */
export default function LotDetail({ lot, color, onClose }) {
  const [copied, setCopied] = useState('');
  if (!lot) return null;

  const age = lotAgeMonths(lot);
  const [lat, lng] = lot.viTri;
  const survival = lot.soCayBanDau ? Math.round((lot.soCayHienHuu / lot.soCayBanDau) * 100) : null;
  const density = lot.dienTichHienHuu ? Math.round(lot.soCayHienHuu / lot.dienTichHienHuu) : null;

  const copy = (text, what) =>
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(what);
      setTimeout(() => setCopied(''), 1500);
    }).catch(() => {});

  const shareUrl = `${location.origin}${location.pathname}?lo=${lot.lo}`;

  return (
    <article className="flex max-h-full flex-col overflow-hidden rounded-xl border border-[#164E33] bg-[#131411]/95 text-emerald-50 shadow-2xl backdrop-blur">
      <header className="flex items-start gap-3 border-b border-[#164E33] bg-[#042918] px-4 py-3">
        <span className="mt-1 size-3 shrink-0 rounded-sm" style={{ background: color }} />
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-bold leading-tight">Lô {lot.lo}</h3>
          <p className="text-xs text-emerald-100/60">
            Cụm {lot.cum} · {lot.doi} · {lot.nongTruong} · Lô cũ {lot.loCu.join(' + ')}
          </p>
        </div>
        <button type="button" onClick={onClose} aria-label="Đóng" className="text-xl leading-none text-emerald-100/60 hover:text-white">×</button>
      </header>

      <div className="overflow-y-auto px-4 py-3">
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[13px]">
          <Row label="Trạng thái">
            <span className={lot.trangThai === 'Đã trồng' ? 'text-emerald-300' : lot.trangThai === 'Đã hủy' ? 'text-red-300' : 'text-amber-300'}>
              {lot.trangThai ?? '—'}
            </span>
          </Row>
          <Row label="Giống">{lot.giong ?? <span className="text-amber-300">Chưa ghi</span>}</Row>
          <Row label="Ngày trồng">{formatDate(lot.ngayTrong)}</Row>
          <Row label="Tuổi cây">{age == null ? '—' : `${age} tháng`}</Row>
          <Row label="DT ban đầu">{formatHa(lot.dienTichBanDau)} · {formatInt(lot.soCayBanDau)} cây</Row>
          <Row label="DT hiện hữu">{formatHa(lot.dienTichHienHuu)}</Row>
          <Row label="Số cây hiện hữu">{formatInt(lot.soCayHienHuu)}</Row>
          <Row label="Mật độ thực tế">{density ? `${formatInt(density)} cây/ha` : '—'}</Row>
          <Row label="Tỷ lệ cây còn">{survival != null ? `${survival}%` : '—'}</Row>
          {lot.taiCanh.map((t) => (
            <Row key={t.dot} label={`Tái canh đợt ${t.dot}`}>
              {formatDate(t.ngay)} · {t.giong} · {formatHa(t.dienTich)}
            </Row>
          ))}
          {lot.phuTrach && <Row label="Phụ trách">{lot.phuTrach}</Row>}
          <Row label="Tọa độ">{lat.toFixed(5)}, {lng.toFixed(5)}</Row>
        </dl>

        {lot.nguonRanhGioi !== 'pdf' && (
          <p className="mt-3 rounded-md bg-amber-400/10 px-2.5 py-2 text-xs text-amber-200">
            Lô này mới có vị trí, chưa có ranh giới. Vào màn hình Vẽ vùng để bổ sung.
          </p>
        )}
        {lot.ghiChu && <p className="mt-2 text-xs text-emerald-100/60">Ghi chú: {lot.ghiChu}</p>}
      </div>

      <footer className="flex gap-2 border-t border-[#164E33] p-3">
        <a
          className={`${btn} bg-[#164E33] text-center text-white`}
          href={`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          Chỉ đường
        </a>
        <button type="button" className={btn} onClick={() => copy(`${lat}, ${lng}`, 'toaDo')}>
          {copied === 'toaDo' ? 'Đã chép' : 'Chép tọa độ'}
        </button>
        <button type="button" className={btn} onClick={() => copy(shareUrl, 'link')}>
          {copied === 'link' ? 'Đã chép' : 'Chia sẻ'}
        </button>
      </footer>
    </article>
  );
}
