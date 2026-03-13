import { View, Text } from 'react-native';
import { BalanceCard } from './BalanceCard';
import { TransactionListCard } from './TransactionListCard';
import { ConfirmationCard } from './ConfirmationCard';
import { LoanOfferCard } from './LoanOfferCard';
import { LoanStatusCard } from './LoanStatusCard';
import { ErrorCard } from './ErrorCard';
import { SuccessCard } from './SuccessCard';
import { PotStatusCard } from './PotStatusCard';
import { InsightCard } from './InsightCard';
import { SpendingBreakdownCard } from './SpendingBreakdownCard';
import { QuickReplyGroup } from './QuickReplyGroup';
import { WelcomeCard } from './WelcomeCard';
import { ChecklistCard } from './ChecklistCard';
import { CreditScoreCard } from './CreditScoreCard';
import { FlexPlanCard } from './FlexPlanCard';
import { PaymentHistoryCard } from './PaymentHistoryCard';
import { AccountDetailsCard } from './AccountDetailsCard';
import { InputCard } from './InputCard';
import type { UIComponent } from '@agentic-bank/shared';

interface UIComponentRendererProps {
  components: UIComponent[];
  onRefresh?: () => void;
  onQuickReply?: (value: string) => void;
}

export function UIComponentRenderer({ components, onRefresh, onQuickReply }: UIComponentRendererProps) {
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

          case 'success_card':
            return (
              <SuccessCard
                key={index}
                title={data.title || 'Success'}
                message={data.message || ''}
                details={data.details}
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

          case 'pot_status_card':
            return (
              <PotStatusCard
                key={index}
                pots={data.pots}
              />
            );

          case 'insight_card':
            return (
              <InsightCard
                key={index}
                title={data.title}
                message={data.message}
                category={data.category}
                changePercent={data.change_percent || data.changePercent}
                period={data.period}
              />
            );

          case 'spending_breakdown_card':
            return (
              <SpendingBreakdownCard
                key={index}
                period={data.period}
                total={data.total || data.total_spent || 0}
                categories={(data.categories || []).map((c: any) => ({
                  name: c.name || c.category,
                  amount: c.amount,
                  percent: c.percent,
                  icon: c.icon || c.category_icon,
                }))}
              />
            );

          case 'quick_reply_group':
            return (
              <QuickReplyGroup
                key={index}
                replies={data.replies || data.quick_replies}
                onSelect={onQuickReply}
              />
            );

          case 'welcome_card':
            return (
              <WelcomeCard
                key={index}
                displayName={data.display_name || data.displayName || ''}
                greeting={data.greeting || ''}
              />
            );

          case 'checklist_card':
            return (
              <ChecklistCard
                key={index}
                items={data.items}
              />
            );

          case 'loan_offer_card':
            return (
              <LoanOfferCard
                key={index}
                amount={data.amount}
                rate={data.rate || data.interest_rate}
                term={data.term || data.term_months}
                monthlyPayment={data.monthly_payment || data.monthlyPayment}
              />
            );

          case 'loan_status_card':
            return (
              <LoanStatusCard
                key={index}
                principal={data.principal}
                remaining={data.remaining || data.balance_remaining}
                rate={data.rate || data.interest_rate}
                monthlyPayment={data.monthly_payment || data.monthlyPayment}
                nextDate={data.next_date || data.nextDate || data.next_payment_date}
                status={data.status}
              />
            );

          case 'credit_score_card':
            return (
              <CreditScoreCard
                key={index}
                score={data.score}
                rating={data.rating}
                factors={data.factors}
                lastUpdated={data.last_updated || data.lastUpdated}
              />
            );

          case 'flex_plan_card':
            return (
              <FlexPlanCard
                key={index}
                plans={data.plans}
                merchantName={data.merchant_name}
                originalAmount={data.original_amount}
                monthlyPayment={data.monthly_payment}
                planMonths={data.plan_months}
                apr={data.apr}
              />
            );

          case 'payment_history_card':
            return (
              <PaymentHistoryCard
                key={index}
                payments={data.payments}
                summary={data.summary}
              />
            );

          case 'account_details_card':
            return (
              <AccountDetailsCard
                key={index}
                accountName={data.account_name || data.accountName}
                sortCode={data.sort_code || data.sortCode}
                accountNumber={data.account_number || data.accountNumber}
                iban={data.iban}
              />
            );

          case 'input_card':
            return (
              <InputCard
                key={index}
                title={data.title}
                subtitle={data.subtitle}
                fields={data.fields || []}
                submitLabel={data.submit_label || data.submitLabel}
                onSubmit={onQuickReply ? (values) => {
                  // Serialize form values as JSON string for the agent
                  onQuickReply(JSON.stringify(values));
                } : undefined}
              />
            );

          default:
            // Fallback for unimplemented card types — show type name
            return (
              <View key={index} className="bg-surface-secondary border border-border-primary rounded-2xl p-3 my-2 mx-1">
                <Text className="text-text-tertiary text-xs">{component.type}</Text>
              </View>
            );
        }
      })}
    </View>
  );
}
