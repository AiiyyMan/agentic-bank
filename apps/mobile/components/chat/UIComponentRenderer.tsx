import { View } from 'react-native';
import { BalanceCard } from './BalanceCard';
import { TransactionListCard } from './TransactionListCard';
import { ConfirmationCard } from './ConfirmationCard';
import { LoanOfferCard } from './LoanOfferCard';
import { LoanStatusCard } from './LoanStatusCard';
import { ErrorCard } from './ErrorCard';
import type { UIComponent } from '@agentic-bank/shared';

interface UIComponentRendererProps {
  components: UIComponent[];
  onRefresh?: () => void;
}

export function UIComponentRenderer({ components, onRefresh }: UIComponentRendererProps) {
  return (
    <View>
      {components.map((component, index) => {
        const data = component.data as any;
        switch (component.type) {
          case 'balance_card':
            return (
              <BalanceCard
                key={index}
                balance={data.balance}
                currency={data.currency}
                accountName={data.account_name || data.accountName}
                accountNumber={data.account_number || data.accountNumber}
              />
            );

          case 'transaction_list':
            return (
              <TransactionListCard
                key={index}
                transactions={data.transactions}
              />
            );

          case 'confirmation_card':
            return (
              <ConfirmationCard
                key={index}
                pendingActionId={data.pending_action_id || data.pendingActionId}
                summary={data.summary}
                details={data.details}
                postTransactionBalance={data.post_transaction_balance || data.postTransactionBalance}
                onConfirmed={onRefresh}
              />
            );

          case 'loan_offer_card':
            return (
              <LoanOfferCard
                key={index}
                amount={data.amount}
                rate={data.rate}
                term={data.term}
                monthlyPayment={data.monthly_payment || data.monthlyPayment}
              />
            );

          case 'loan_status_card':
            return (
              <LoanStatusCard
                key={index}
                principal={data.principal}
                remaining={data.remaining}
                rate={data.rate}
                monthlyPayment={data.monthly_payment || data.monthlyPayment}
                nextDate={data.next_date || data.nextDate}
                status={data.status}
              />
            );

          case 'error_card':
            return (
              <ErrorCard
                key={index}
                message={data.message}
                retryable={data.retryable}
                onRetry={onRefresh}
              />
            );

          default:
            return null;
        }
      })}
    </View>
  );
}
