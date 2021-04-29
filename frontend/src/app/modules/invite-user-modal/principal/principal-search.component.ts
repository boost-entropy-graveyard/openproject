import {
  Component,
  Input,
  EventEmitter,
  OnInit,
  Output,
  ElementRef,
} from '@angular/core';
import {FormControl} from "@angular/forms";
import {Observable, BehaviorSubject, combineLatest, forkJoin} from "rxjs";
import {debounceTime, distinctUntilChanged, tap, shareReplay, map, switchMap} from "rxjs/operators";
import {APIV3Service} from "core-app/modules/apiv3/api-v3.service";
import {ApiV3FilterBuilder} from "core-components/api/api-v3/api-v3-filter-builder";
import {I18nService} from "core-app/modules/common/i18n/i18n.service";
import {UntilDestroyedMixin} from "core-app/helpers/angular/until-destroyed.mixin";
import {ProjectResource} from "core-app/modules/hal/resources/project-resource";
import {CapabilityResource} from "core-app/modules/hal/resources/capability-resource";
import {PrincipalLike} from "core-app/modules/principal/principal-types";
import {CurrentUserService} from "core-app/modules/current-user/current-user.service";
import {PrincipalType} from '../invite-user.component';

interface NgSelectPrincipalOption {
  principal: PrincipalLike,
  disabled: boolean;
};

@Component({
  selector: 'op-ium-principal-search',
  templateUrl: './principal-search.component.html',
})
export class PrincipalSearchComponent extends UntilDestroyedMixin implements OnInit {
  @Input('opFormBinding') principalControl:FormControl;
  @Input() type:PrincipalType;
  @Input() project:ProjectResource;

  @Output() createNew = new EventEmitter<PrincipalLike>();

  public input$ = new BehaviorSubject<string>('');
  public input = '';
  public items$: Observable<NgSelectPrincipalOption[]> = this.input$
    .pipe(
      this.untilDestroyed(),
      debounceTime(200),
      distinctUntilChanged(),
      switchMap(this.loadPrincipalData.bind(this)),
    );
    
  public canInviteByEmail$ = combineLatest(
    this.items$,
    this.input$,
    this.currentUserService.capabilities$.pipe(
      map(capabilities => !!capabilities.find(c => c.action.href.endsWith('/users/create'))),
      distinctUntilChanged(),
    ),
  ).pipe(
    map(([elements, input, canCreateUsers]) =>
      canCreateUsers
      && this.type === PrincipalType.User
      && input?.includes('@')
      && !elements.find((el:any) => el.email === input)
    ),
  );

  public canCreateNewPlaceholder$ = combineLatest(
    this.items$,
    this.input$,
    this.currentUserService.capabilities$.pipe(
      map(capabilities => !!capabilities.find(c => c.action.href.endsWith('/placeholder_users/create'))),
      distinctUntilChanged(),
    ),
  ).pipe(
    map(([elements, input, hasCapability]) => {
      if (!hasCapability) {
        return false;
      }

      if (this.type !== PrincipalType.Placeholder) {
        return false;
      }

      return !!input && !elements.find((el:any) => el.name === input);
    }),
  );

  public showAddTag = false;

  public text = {
    alreadyAMember: () => this.I18n.t('js.invite_user_modal.principal.already_member_message', {
      project: this.project?.name,
    }),
    inviteNewUser: this.I18n.t('js.invite_user_modal.principal.invite_user'),
    createNewPlaceholder: this.I18n.t('js.invite_user_modal.principal.create_new_placeholder'),
    noResults: {
      User: this.I18n.t('js.invite_user_modal.principal.no_results_user'),
      PlaceholderUser: this.I18n.t('js.invite_user_modal.principal.no_results_placeholder'),
      Group: this.I18n.t('js.invite_user_modal.principal.no_results_group'),
    },
  };

  constructor(
    public I18n:I18nService,
    readonly elementRef:ElementRef,
    readonly apiV3Service:APIV3Service,
    readonly currentUserService:CurrentUserService,
  ) {
    super();

    this.input$.subscribe((input:string) => {
      this.input = input;
    });

    combineLatest(
      this.canInviteByEmail$,
      this.canCreateNewPlaceholder$,
    ).pipe(
      map(([canInviteByEmail, canCreateNewPlaceholder]:boolean[]) => canInviteByEmail || canCreateNewPlaceholder)
    ).subscribe(showAddTag => { this.showAddTag = showAddTag; });
  }

  ngOnInit() {
    // Make sure we have initial data
    setTimeout(() => this.input$.next(''));
  }

  createNewFromInput() {
    this.createNew.emit({ name: this.input });
  }

  private loadPrincipalData(searchTerm:string) {
    const nonMemberFilter = new ApiV3FilterBuilder();
    if (searchTerm) {
      nonMemberFilter.add('name', '~', [searchTerm]);
    }
    nonMemberFilter.add('status', '!', [3]);
    nonMemberFilter.add('type', '=', [this.type]);
    nonMemberFilter.add('member', '!', [this.project?.id]);
    const nonMembers = this.apiV3Service.principals.filtered(nonMemberFilter).get();

    const memberFilter = new ApiV3FilterBuilder();
    if (searchTerm) {
      memberFilter.add('name', '~', [searchTerm]);
    }
    memberFilter.add('status', '!', [3]);
    memberFilter.add('type', '=', [this.type]);
    memberFilter.add('member', '=', [this.project?.id]);
    const members = this.apiV3Service.principals.filtered(memberFilter).get();

    return forkJoin({
      members,
      nonMembers,
    })
      .pipe(
        map(({ members, nonMembers }) => [
          ...nonMembers.elements.map((nonMember:PrincipalLike) => ({
            principal: nonMember,
            disabled: false,
          })),
          ...members.elements.map((member:PrincipalLike) => ({
            principal: member,
            disabled: true,
          })),
        ]),
        shareReplay(1),
      );
  }

  compareWith = (a: NgSelectPrincipalOption, b: PrincipalLike) => {
    return a.principal.id === b.id;
  }
}