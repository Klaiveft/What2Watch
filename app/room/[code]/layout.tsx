import { RoomProvider } from '@/components/RoomProvider'

export default function RoomLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: { code: string }
}) {
  return (
    <RoomProvider roomCodeParam={params.code}>
      {children}
    </RoomProvider>
  )
}
