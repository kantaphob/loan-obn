import Link from 'next/link'
import { ChevronLeft, ChevronRight, MapPin, Search, SearchX } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import './postcode-search.css'
import { Card } from '@/components/ui/card'
import { PageContainer } from '@/components/ui/page-container'
import { SubpageHeader } from '@/components/ui/subpage-header'
import { MasterdataSubnav } from '@/components/dashboard/masterdata-subnav'

const PAGE_SIZE = 25

type PageProps = {
  searchParams: Promise<{ q?: string | string[]; page?: string | string[] }>
}

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

function pageHref(page: number, query: string) {
  const params = new URLSearchParams()
  if (query) params.set('q', query)
  params.set('page', String(page))
  return `/dashboard/admin/masterdata/postcode?${params.toString()}`
}

export default async function PostcodeMasterdataPage({ searchParams }: PageProps) {
  const params = await searchParams
  const query = firstValue(params.q)?.trim().slice(0, 100) ?? ''
  const requestedPage = Number(firstValue(params.page) ?? '1')
  const safeRequestedPage = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1

  const where = query
    ? {
        OR: [
          { code: { contains: query } },
          { subdistricts: { some: { nameTh: { contains: query } } } },
          { subdistricts: { some: { nameEn: { contains: query } } } },
          { subdistricts: { some: { district: { nameTh: { contains: query } } } } },
          { subdistricts: { some: { district: { nameEn: { contains: query } } } } },
          {
            subdistricts: {
              some: {
                district: {
                  province: { nameTh: { contains: query } },
                },
              },
            },
          },
          {
            subdistricts: {
              some: {
                district: {
                  province: { nameEn: { contains: query } },
                },
              },
            },
          },
        ],
      }
    : undefined

  const total = await prisma.postcode.count({ where })
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const page = Math.min(safeRequestedPage, pageCount)
  const postcodes = await prisma.postcode.findMany({
    where,
    orderBy: { code: 'asc' },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    select: {
      code: true,
      subdistricts: {
        orderBy: { id: 'asc' },
        select: {
          id: true,
          nameTh: true,
          district: {
            select: {
              nameTh: true,
              province: { select: { nameTh: true } },
            },
          },
        },
      },
    },
  })

  const startRecord = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const endRecord = Math.min(page * PAGE_SIZE, total)

  return (
    <div className="relative z-10 min-h-[calc(100dvh-24px)] font-sans text-[#222325]">
      <PageContainer>
        <SubpageHeader
          title="รหัสไปรษณีย์"
          eyebrow="Administration"
          description="ข้อมูลรหัสไปรษณีย์และพื้นที่ในประเทศไทย"
        />

        <MasterdataSubnav />
        <Card as="section" className="overflow-hidden rounded-[20px]">
          <div className="border-b border-white/10 p-5 max-[560px]:p-4">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="m-0 text-base font-semibold text-slate-100">รายการรหัสไปรษณีย์</h2>
                <p className="mb-0 mt-1 text-xs leading-5 text-slate-400">ค้นหาพื้นที่และดูตำบลที่อยู่ในแต่ละรหัสไปรษณีย์</p>
              </div>
              <span className="inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1.5 text-xs font-medium text-emerald-200">
                <MapPin size={14} aria-hidden="true" />
                {total.toLocaleString('th-TH')} {query ? 'รหัสที่พบ' : 'รหัสไปรษณีย์'}
              </span>
            </div>
            <form method="get" action="/dashboard/admin/masterdata/postcode" className="postcode-search-search" role="search">
              <label htmlFor="postcode-search" className="postcode-search-label">ค้นหาพื้นที่</label>
              <div className="postcode-search-searchBar">
                <span className="postcode-search-searchIcon"><Search size={21} strokeWidth={1.7} aria-hidden="true" /></span>
                <input id="postcode-search" type="search" name="q" defaultValue={query} placeholder="พิมพ์รหัสไปรษณีย์ หรือชื่อพื้นที่…" aria-describedby="postcode-search-hint" className="postcode-search-input" />
                <button type="submit" className="postcode-search-submit">ค้นหา<ChevronRight size={16} aria-hidden="true" /></button>
              </div>
              <div className="postcode-search-searchFooter">
                <p id="postcode-search-hint" className="postcode-search-hint">ค้นหาได้ทั้งรหัสไปรษณีย์ ตำบล อำเภอ และจังหวัด</p>
                {query ? <Link href="/dashboard/admin/masterdata/postcode" className="postcode-search-clear">ล้างการค้นหา</Link> : null}
              </div>
              <div className="postcode-search-suggestions" aria-label="คำค้นตัวอย่าง">
                <span className="postcode-search-suggestionLabel">ลองค้นหา</span>
                {['10200', 'กรุงเทพมหานคร', 'เชียงใหม่', 'ภูเก็ต'].map((term) => (
                  <Link key={term} href={`/dashboard/admin/masterdata/postcode?q=${encodeURIComponent(term)}`} className="postcode-search-chip" aria-current={query === term ? 'true' : undefined}>{term}</Link>
                ))}
              </div>
            </form>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-xs text-slate-400">
            <span>{query ? <>ผลการค้นหา “<span className="break-all text-slate-200">{query}</span>”</> : 'เรียงตามรหัสไปรษณีย์จากน้อยไปมาก'}</span>
            <span>แสดง {startRecord.toLocaleString('th-TH')}–{endRecord.toLocaleString('th-TH')} จาก {total.toLocaleString('th-TH')}</span>
          </div>
          {postcodes.length === 0 ? (
            <div className="flex flex-col items-center border-t border-white/10 px-6 py-16 text-center">
              <SearchX size={28} aria-hidden="true" className="mb-4 text-slate-500" />
              <h3 className="m-0 text-sm font-semibold text-slate-100">ไม่พบข้อมูลที่ค้นหา</h3>
              <p className="mb-0 mt-2 text-xs text-slate-400">ลองใช้รหัสไปรษณีย์หรือชื่อพื้นที่อื่น</p>
              <Link href="/dashboard/admin/masterdata/postcode" className="mt-4 rounded-lg px-3 py-2 text-xs text-sky-300 underline underline-offset-4">แสดงข้อมูลทั้งหมด</Link>
            </div>
          ) : (
            <div className="postcode-results">
              <div className="postcode-results-heading" aria-hidden="true">
                <span>รหัสไปรษณีย์</span><span>จังหวัด / พื้นที่ให้บริการ</span><span>จำนวนพื้นที่</span><span />
              </div>
              <ul className="postcode-results-list">
                {postcodes.map((postcode) => {
                  const provinces = [...new Set(postcode.subdistricts.map((area) => area.district.province.nameTh))]
                  const groups = new Map<string, { district: string; province: string; areas: typeof postcode.subdistricts }>()
                  for (const area of postcode.subdistricts) {
                    const key = `${area.district.province.nameTh}:${area.district.nameTh}`
                    const group = groups.get(key)
                    if (group) group.areas.push(area)
                    else groups.set(key, { district: area.district.nameTh, province: area.district.province.nameTh, areas: [area] })
                  }
                  return (
                    <li key={postcode.code}>
                      <details key={`${postcode.code}-${query}`} className="postcode-result">
                        <summary className="postcode-result-summary" aria-label={`ดูพื้นที่รหัสไปรษณีย์ ${postcode.code}`}>
                          <span className="postcode-result-code">{postcode.code}</span>
                          <span className="postcode-result-location">
                            <span className="postcode-result-province">{provinces.join(' / ') || 'ยังไม่มีพื้นที่เชื่อมโยง'}</span>
                            <span className="postcode-result-districts">{[...groups.values()].map((group) => group.district).join(' · ')}</span>
                          </span>
                          <span className="postcode-result-count"><strong>{groups.size}</strong> อำเภอ / เขต<span> · </span><strong>{postcode.subdistricts.length}</strong> ตำบล / แขวง</span>
                          <span className="postcode-result-toggle"><span className="postcode-result-show">ดูพื้นที่</span><span className="postcode-result-hide">ย่อรายการ</span><ChevronRight size={16} aria-hidden="true" /></span>
                        </summary>
                        <div className="postcode-result-body">
                          <div className="postcode-result-body-heading"><MapPin size={15} aria-hidden="true" /><h3>พื้นที่ในรหัสไปรษณีย์ {postcode.code}</h3></div>
                          {groups.size ? (
                            <div className="postcode-result-groups">
                              {[...groups.entries()].map(([key, group]) => (
                                <section key={key} className="postcode-result-group" aria-label={`${group.district} ${group.province}`}>
                                  <div className="postcode-result-group-heading">
                                    <div><h4>{group.district}</h4><p>{group.province}</p></div>
                                    <span>{group.areas.length} ตำบล / แขวง</span>
                                  </div>
                                  <ul className="postcode-result-areas">{group.areas.map((area) => <li key={area.id}>{area.nameTh}</li>)}</ul>
                                </section>
                              ))}
                            </div>
                          ) : <p className="text-xs text-slate-400">ยังไม่มีพื้นที่เชื่อมโยง</p>}
                        </div>
                      </details>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}
          <nav aria-label="แบ่งหน้ารหัสไปรษณีย์" className="flex flex-wrap items-center justify-between gap-3 bg-white/[0.02] px-5 py-4">
            <span className="text-xs text-slate-400">หน้า <span className="font-medium text-slate-200">{page.toLocaleString('th-TH')}</span> จาก {pageCount.toLocaleString('th-TH')}</span>
            <div className="flex items-center gap-2">
              {page > 1 ? <Link href={pageHref(page - 1, query)} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-white/10 px-3 text-xs text-slate-200 hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-sky-300"><ChevronLeft size={14} aria-hidden="true" />ก่อนหน้า</Link> : <span aria-disabled="true" className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-white/5 px-3 text-xs text-slate-600"><ChevronLeft size={14} aria-hidden="true" />ก่อนหน้า</span>}
              {page < pageCount ? <Link href={pageHref(page + 1, query)} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-white/10 px-3 text-xs text-slate-200 hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-sky-300">ถัดไป<ChevronRight size={14} aria-hidden="true" /></Link> : <span aria-disabled="true" className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-white/5 px-3 text-xs text-slate-600">ถัดไป<ChevronRight size={14} aria-hidden="true" /></span>}
            </div>
          </nav>
        </Card>
      </PageContainer>
    </div>
  )
}
