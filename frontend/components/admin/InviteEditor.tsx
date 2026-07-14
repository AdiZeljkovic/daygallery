'use client';

import { useState, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { motion } from 'motion/react';
import {
  ArrowLeft,
  Plus,
  Trash2,
  Loader2,
  ImagePlus,
  Heart,
  Clock,
  BookHeart,
  Stamp,
  Music2,
} from 'lucide-react';
import { Link, useRouter } from '@/i18n/navigation';
import { api, ApiError } from '@/lib/api';
import { imageUrl } from '@/lib/menuTypes';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

interface ScheduleItem {
  time: string;
  title: string;
  location: string;
}

interface StoryItem {
  when: string;
  title: string;
  text: string;
}

export interface InviteDetail {
  id: number;
  slug: string;
  title: string;
  hostNames: string;
  variant: 'standard' | 'wedding';
  date: string | null;
  time: string | null;
  location: string | null;
  message: string | null;
  eventId: number | null;
  coverImagePath: string | null;
  weddingDetails: {
    heroEyebrow?: string;
    countdownSub?: string;
    rsvpSub?: string;
    story?: StoryItem[];
    venueName?: string;
    venueAddress?: string;
    venueMaps?: string;
  } | null;
  design: {
    sealInitials?: string;
    sealFont?: SealFont;
    musicTrack?: MusicTrack;
  } | null;
  schedule: { time: string; title: string; location: string | null }[];
}

type SealFont = 'cinzel' | 'cormorant' | 'playfairSC';
type MusicTrack = 'none' | 'royal-1' | 'royal-2' | 'royal-3';

const MUSIC_OPTIONS: { value: MusicTrack; label: string }[] = [
  { value: 'none', label: 'Bez muzike' },
  { value: 'royal-1', label: 'Royal 1' },
  { value: 'royal-2', label: 'Royal 2' },
  { value: 'royal-3', label: 'Royal 3' },
];

const SEAL_FONT_CLASS: Record<SealFont, string> = {
  cinzel: 'font-cinzel',
  cormorant: 'font-cormorant',
  playfairSC: 'font-playfair-sc',
};

const SEAL_FONT_OPTIONS: { value: SealFont; label: string }[] = [
  { value: 'cinzel', label: 'Cinzel — ugravirani (kapiteli)' },
  { value: 'cormorant', label: 'Cormorant — elegantni serif' },
  { value: 'playfairSC', label: 'Playfair SC — mala slova' },
];

export function InviteEditor({ invite }: { invite?: InviteDetail }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState(invite?.title ?? '');
  const [hostNames, setHostNames] = useState(invite?.hostNames ?? '');
  const [date, setDate] = useState(invite?.date?.slice(0, 10) ?? '');
  const [time, setTime] = useState(invite?.time ?? '');
  const [location, setLocation] = useState(invite?.location ?? '');
  const [message, setMessage] = useState(invite?.message ?? '');
  const [eventId, setEventId] = useState<string>(invite?.eventId?.toString() ?? '');
  const [isWedding, setIsWedding] = useState(invite?.variant === 'wedding');
  const [schedule, setSchedule] = useState<ScheduleItem[]>(
    invite?.schedule.map((s) => ({ time: s.time, title: s.title, location: s.location ?? '' })) ?? []
  );
  const [coverPath, setCoverPath] = useState(invite?.coverImagePath ?? null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pečat (opener)
  const [sealInitials, setSealInitials] = useState(invite?.design?.sealInitials ?? '');
  const [sealFont, setSealFont] = useState<SealFont>(invite?.design?.sealFont ?? 'cinzel');
  const [musicTrack, setMusicTrack] = useState<MusicTrack>(invite?.design?.musicTrack ?? 'none');
  const derivedInitials = hostNames
    .split('&')
    .map((n) => n.trim()[0])
    .filter(Boolean)
    .join('');
  const previewInitials = sealInitials.trim() || derivedInitials || '♥';

  const wd = invite?.weddingDetails;
  const [heroEyebrow, setHeroEyebrow] = useState(wd?.heroEyebrow ?? 'Sa radošću vas pozivamo');
  const [countdownSub, setCountdownSub] = useState(wd?.countdownSub ?? 'do našeg posebnog dana');
  const [rsvpSub, setRsvpSub] = useState(wd?.rsvpSub ?? 'Molimo potvrdite dolazak');
  const [story, setStory] = useState<StoryItem[]>(wd?.story ?? []);
  const [venueName, setVenueName] = useState(wd?.venueName ?? '');
  const [venueAddress, setVenueAddress] = useState(wd?.venueAddress ?? '');
  const [venueMaps, setVenueMaps] = useState(wd?.venueMaps ?? '');

  const { data: events } = useQuery({
    queryKey: ['events'],
    queryFn: () => api<{ id: number; name: string }[]>('/api/events'),
  });

  const save = useMutation({
    mutationFn: async () => {
      const body = JSON.stringify({
        title,
        hostNames,
        date: date || '',
        time,
        location,
        message,
        eventId: eventId ? Number(eventId) : null,
        variant: isWedding ? 'wedding' : 'standard',
        design: { sealInitials: sealInitials.trim(), sealFont, musicTrack, theme: 'emeraldGold' },
        weddingDetails: isWedding
          ? {
              heroEyebrow,
              countdownSub,
              rsvpSub,
              story: story.filter((s) => s.title.trim()),
              venueName,
              venueAddress,
              venueMaps,
            }
          : null,
        schedule: schedule.filter((s) => s.time.trim() && s.title.trim()),
      });
      return invite
        ? api<InviteDetail>(`/api/invites/${invite.id}`, { method: 'PATCH', body })
        : api<InviteDetail>('/api/invites', { method: 'POST', body });
    },
    onSuccess: () => router.push('/admin/invites'),
    onError: (e) => setError(e instanceof ApiError ? e.message : 'Greška pri spremanju'),
  });

  const uploadCover = async (file: File) => {
    if (!invite) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append('image', file);
      const res = await fetch(`${API_URL}/api/invites/${invite.id}/cover`, {
        method: 'POST',
        credentials: 'include',
        body: form,
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Upload nije uspio');
      setCoverPath((await res.json()).coverImagePath);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload nije uspio');
    } finally {
      setUploading(false);
    }
  };

  const input = 'w-full rounded-lg border border-ink/12 px-3 py-2 text-sm outline-none transition-colors focus:border-gold';

  return (
    <div className="max-w-2xl">
      <div className="mb-6 flex items-center gap-3">
        <Link
          href="/admin/invites"
          className="rounded-lg p-2 text-ink/40 transition-colors hover:bg-ink/5 hover:text-ink"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="font-display text-2xl font-bold">
          {invite ? 'Uredi pozivnicu' : 'Nova pozivnica'}
        </h1>
      </div>

      <div className="space-y-5">
        {/* Osnovno */}
        <Section title="Osnovni podaci">
          <div className="grid gap-3 sm:grid-cols-2">
            <input placeholder="Naslov (npr. Svadba Amina & Emir)" value={title} onChange={(e) => setTitle(e.target.value)} className={`${input} sm:col-span-2`} />
            <input placeholder="Imena domaćina (npr. Amina & Emir)" value={hostNames} onChange={(e) => setHostNames(e.target.value)} className={`${input} sm:col-span-2`} />
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={input} />
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={input} />
            <input placeholder="Lokacija" value={location} onChange={(e) => setLocation(e.target.value)} className={`${input} sm:col-span-2`} />
            <textarea placeholder="Poruka gostima..." value={message} onChange={(e) => setMessage(e.target.value)} rows={3} className={`${input} resize-none sm:col-span-2`} />
            <select value={eventId} onChange={(e) => setEventId(e.target.value)} className={`${input} bg-white sm:col-span-2`}>
              <option value="">Bez povezanog eventa</option>
              {events?.map((ev) => (
                <option key={ev.id} value={ev.id}>{ev.name}</option>
              ))}
            </select>
          </div>
        </Section>

        {/* Cover */}
        <Section title="Cover slika">
          <button
            type="button"
            onClick={() => invite && fileRef.current?.click()}
            disabled={!invite || uploading}
            className="relative flex h-40 w-full items-center justify-center overflow-hidden rounded-xl border border-dashed border-ink/20 text-ink/35 transition-colors hover:border-gold hover:text-gold-dark disabled:cursor-not-allowed"
          >
            {coverPath ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imageUrl(coverPath)!} alt="" className="h-full w-full object-cover" />
            ) : uploading ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              <span className="flex flex-col items-center gap-2 text-sm">
                <ImagePlus className="h-6 w-6" />
                {invite ? 'Dodaj cover sliku' : 'Cover se dodaje nakon prvog spremanja'}
              </span>
            )}
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && uploadCover(e.target.files[0])} />
        </Section>

        {/* Pečat (opener) */}
        <Section title="Pečat (koverta pri otvaranju)">
          <p className="mb-4 text-sm text-ink/50">
            Gost prvo vidi kovertu sa zlatnim pečatom. Upiši inicijale/monogram i izaberi font.
          </p>
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            {/* Živi pregled */}
            <div className="flex shrink-0 flex-col items-center gap-2">
              <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-gold-light via-gold to-gold-dark shadow-lifted">
                <div className="pointer-events-none absolute inset-0 rounded-full [background:radial-gradient(circle_at_32%_28%,rgba(255,255,255,0.7),transparent_45%)]" />
                <div className="absolute inset-[7px] rounded-full border border-black/20" />
                <span className={`relative text-3xl font-bold text-black/80 ${SEAL_FONT_CLASS[sealFont]}`}>
                  {previewInitials}
                </span>
              </div>
              <span className="flex items-center gap-1 text-[10px] uppercase tracking-widest text-ink/35">
                <Stamp className="h-3 w-3" /> Pregled
              </span>
            </div>

            <div className="flex-1 space-y-3">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-ink/50">Inicijali / monogram</span>
                <input
                  placeholder={derivedInitials || 'npr. A&E'}
                  value={sealInitials}
                  maxLength={8}
                  onChange={(e) => setSealInitials(e.target.value)}
                  className={input}
                />
                <span className="mt-1 block text-[11px] text-ink/35">
                  Ostavi prazno → automatski iz imena ({derivedInitials || '♥'}).
                </span>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-ink/50">Font pečata</span>
                <select
                  value={sealFont}
                  onChange={(e) => setSealFont(e.target.value as SealFont)}
                  className={`${input} bg-white`}
                >
                  {SEAL_FONT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        </Section>

        {/* Muzika */}
        <Section title="Muzika (royal pozivnica)">
          <p className="mb-3 flex items-center gap-1.5 text-sm text-ink/50">
            <Music2 className="h-4 w-4 text-gold-dark" />
            Pozadinska muzika kreće kad gost klikne "Otvori"; može se utišati.
          </p>
          <select
            value={musicTrack}
            onChange={(e) => setMusicTrack(e.target.value as MusicTrack)}
            className={`${input} bg-white`}
          >
            {MUSIC_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </Section>

        {/* Program */}
        <Section
          title="Program dana"
          action={
            <button
              onClick={() => setSchedule((s) => [...s, { time: '', title: '', location: '' }])}
              className="flex items-center gap-1 rounded-lg bg-gold/10 px-2.5 py-1.5 text-xs font-medium text-gold-dark transition-colors hover:bg-gold/20"
            >
              <Plus className="h-3.5 w-3.5" /> Dodaj
            </button>
          }
        >
          {schedule.length === 0 && (
            <p className="flex items-center gap-2 text-sm text-ink/35">
              <Clock className="h-4 w-4" /> Nema stavki programa.
            </p>
          )}
          <div className="space-y-2">
            {schedule.map((item, i) => (
              <div key={i} className="flex gap-2">
                <input type="time" value={item.time} onChange={(e) => setSchedule((s) => s.map((x, j) => (j === i ? { ...x, time: e.target.value } : x)))} className={`${input} w-28 shrink-0`} />
                <input placeholder="Naziv (npr. Vjenčanje)" value={item.title} onChange={(e) => setSchedule((s) => s.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} className={input} />
                <input placeholder="Lokacija" value={item.location} onChange={(e) => setSchedule((s) => s.map((x, j) => (j === i ? { ...x, location: e.target.value } : x)))} className={input} />
                <button onClick={() => setSchedule((s) => s.filter((_, j) => j !== i))} className="shrink-0 rounded-lg p-2 text-ink/30 hover:bg-red-50 hover:text-red-500">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </Section>

        {/* Wedding varijanta */}
        <Section title="Vjenčanje">
          <label className="flex cursor-pointer items-center gap-2.5">
            <input type="checkbox" checked={isWedding} onChange={(e) => setIsWedding(e.target.checked)} className="h-4 w-4 accent-[#d4af37]" />
            <span className="flex items-center gap-1.5 text-sm">
              <Heart className="h-3.5 w-3.5 fill-gold text-gold" />
              Bogata wedding pozivnica (naša priča, lokacija, custom tekstovi)
            </span>
          </label>

          {isWedding && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mt-4 space-y-3 overflow-hidden">
              <input placeholder="Tekst iznad imena (npr. Sa radošću vas pozivamo)" value={heroEyebrow} onChange={(e) => setHeroEyebrow(e.target.value)} className={input} />
              <input placeholder="Tekst ispod odbrojavanja" value={countdownSub} onChange={(e) => setCountdownSub(e.target.value)} className={input} />
              <input placeholder="Tekst iznad RSVP forme" value={rsvpSub} onChange={(e) => setRsvpSub(e.target.value)} className={input} />

              <div className="grid gap-3 sm:grid-cols-2">
                <input placeholder="Naziv lokacije (npr. Hotel Hills)" value={venueName} onChange={(e) => setVenueName(e.target.value)} className={input} />
                <input placeholder="Adresa" value={venueAddress} onChange={(e) => setVenueAddress(e.target.value)} className={input} />
                <input placeholder="Google Maps link" value={venueMaps} onChange={(e) => setVenueMaps(e.target.value)} className={`${input} sm:col-span-2`} />
              </div>

              <div className="flex items-center justify-between pt-1">
                <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-ink/45">
                  <BookHeart className="h-3.5 w-3.5" /> Naša priča
                </p>
                <button
                  onClick={() => setStory((s) => [...s, { when: '', title: '', text: '' }])}
                  className="flex items-center gap-1 rounded-lg bg-gold/10 px-2.5 py-1.5 text-xs font-medium text-gold-dark hover:bg-gold/20"
                >
                  <Plus className="h-3.5 w-3.5" /> Dodaj poglavlje
                </button>
              </div>
              {story.map((item, i) => (
                <div key={i} className="space-y-2 rounded-xl border border-ink/8 p-3">
                  <div className="flex gap-2">
                    <input placeholder="Kada (npr. 2019.)" value={item.when} onChange={(e) => setStory((s) => s.map((x, j) => (j === i ? { ...x, when: e.target.value } : x)))} className={`${input} w-32 shrink-0`} />
                    <input placeholder="Naslov (npr. Prvi susret)" value={item.title} onChange={(e) => setStory((s) => s.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} className={input} />
                    <button onClick={() => setStory((s) => s.filter((_, j) => j !== i))} className="shrink-0 rounded-lg p-2 text-ink/30 hover:bg-red-50 hover:text-red-500">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <textarea placeholder="Tekst..." value={item.text} onChange={(e) => setStory((s) => s.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))} rows={2} className={`${input} resize-none`} />
                </div>
              ))}
            </motion.div>
          )}
        </Section>
      </div>

      {error && <p className="mt-4 text-sm text-red-500">{error}</p>}

      <button
        onClick={() => save.mutate()}
        disabled={!title.trim() || !hostNames.trim() || save.isPending}
        className="btn-glossy mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-gold py-3 font-semibold text-neutral-900 transition-colors disabled:opacity-50"
      >
        {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
        {invite ? 'Sačuvaj izmjene' : 'Kreiraj pozivnicu'}
      </button>
    </div>
  );
}

function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-ink/8 bg-white p-5 shadow-soft">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-ink/45">{title}</h2>
        {action}
      </div>
      {children}
    </div>
  );
}
