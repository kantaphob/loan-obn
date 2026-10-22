import { Header, type HeaderProps } from '@/components/ui/header'

export type SubpageHeaderProps = HeaderProps

/** Shared heading for child pages. Navigation lives below the header. */
export function SubpageHeader(props: SubpageHeaderProps) {
  return <Header {...props} />
}
