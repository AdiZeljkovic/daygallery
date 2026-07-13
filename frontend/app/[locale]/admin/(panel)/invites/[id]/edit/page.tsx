'use client';

import { use } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { InviteEditor, type InviteDetail } from '@/components/admin/InviteEditor';

export default function EditInvitePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const { data: invite, isLoading } = useQuery({
    queryKey: ['invite', id],
    queryFn: () => api<InviteDetail>(`/api/invites/${id}`),
  });

  if (isLoading || !invite) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-gold-dark" />
      </div>
    );
  }

  return <InviteEditor invite={invite} />;
}
