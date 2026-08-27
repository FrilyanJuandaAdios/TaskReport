import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/common/EmptyState'
import { Page } from '@/components/layout/Page'
import { ROUTES } from '@/constants/navigation'

export function NotFoundPage() {
  return (
    <Page>
      <EmptyState
        title="Page not found"
        description="The link may be out of date."
        action={
          <Button asChild variant="outline" size="sm">
            <Link to={ROUTES.today}>Back to today</Link>
          </Button>
        }
      />
    </Page>
  )
}
